import {createHmac} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {
  buildPreviewCookie,
  enforceLaunchGate,
  getPreviewCookieValue,
  hasPreviewCookie,
  isLaunchGateActive,
  primePreviewCookie,
  tokensMatch,
} from '~/lib/.server/coming-soon.server';

const SECRETS = {
  SESSION_SECRET: 'session-secret',
  PREVIEW_TOKEN: 'preview-token',
};

function env(overrides: Partial<Env> = {}): Env {
  return {COMING_SOON: 'true', ...SECRETS, ...overrides} as Env;
}

function request(path = '/', cookie?: string, host = 'lightboard.co.il') {
  return new Request(`https://${host}${path}`, {
    headers: cookie ? {cookie} : {},
  });
}

describe('preview cookie value', () => {
  it('is HMAC-SHA256(SESSION_SECRET, "lb_preview:" + PREVIEW_TOKEN) in hex', async () => {
    const expected = createHmac('sha256', SECRETS.SESSION_SECRET)
      .update(`lb_preview:${SECRETS.PREVIEW_TOKEN}`)
      .digest('hex');
    expect(await getPreviewCookieValue(env())).toBe(expected);
  });

  it('is null when either secret is missing', async () => {
    expect(
      await getPreviewCookieValue(env({PREVIEW_TOKEN: undefined})),
    ).toBeNull();
    expect(await getPreviewCookieValue(env({SESSION_SECRET: ''}))).toBeNull();
  });

  it('is set as an httpOnly, Secure, SameSite=Lax cookie for 30 days', () => {
    expect(buildPreviewCookie('abc')).toBe(
      'lb_preview=abc; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax',
    );
  });
});

describe('launch gate', () => {
  it('is off unless COMING_SOON is exactly "true"', () => {
    expect(isLaunchGateActive(request(), env({COMING_SOON: 'false'}))).toBe(
      false,
    );
    expect(isLaunchGateActive(request(), env({COMING_SOON: 'TRUE'}))).toBe(
      false,
    );
    expect(isLaunchGateActive(request(), env())).toBe(true);
  });

  it('always lets localhost through', () => {
    expect(
      isLaunchGateActive(request('/', undefined, 'localhost:3000'), env()),
    ).toBe(false);
    expect(
      isLaunchGateActive(request('/', undefined, '127.0.0.1'), env()),
    ).toBe(false);
  });

  it('lets a valid signed cookie through once primed', async () => {
    const e = env();
    await primePreviewCookie(e);
    const value = await getPreviewCookieValue(e);
    const req = request('/products/x', `other=1; lb_preview=${value}`);
    expect(hasPreviewCookie(req, e)).toBe(true);
    expect(isLaunchGateActive(req, e)).toBe(false);
  });

  it('rejects a forged cookie', async () => {
    const e = env();
    await primePreviewCookie(e);
    const forged = createHmac('sha256', 'guess')
      .update(`lb_preview:${SECRETS.PREVIEW_TOKEN}`)
      .digest('hex');
    expect(hasPreviewCookie(request('/', `lb_preview=${forged}`), e)).toBe(
      false,
    );
    expect(hasPreviewCookie(request('/', 'lb_preview='), e)).toBe(false);
  });

  it('revokes issued cookies when a secret is rotated', async () => {
    const old = env();
    await primePreviewCookie(old);
    const issued = await getPreviewCookieValue(old);
    const rotated = env({PREVIEW_TOKEN: 'new-token'});
    // Not yet primed for the new secrets: fail closed.
    expect(
      hasPreviewCookie(request('/', `lb_preview=${issued}`), rotated),
    ).toBe(false);
    await primePreviewCookie(rotated);
    expect(
      hasPreviewCookie(request('/', `lb_preview=${issued}`), rotated),
    ).toBe(false);
    const fresh = await getPreviewCookieValue(rotated);
    expect(hasPreviewCookie(request('/', `lb_preview=${fresh}`), rotated)).toBe(
      true,
    );
  });

  it('redirects gated deep links to / and keeps the query string', () => {
    let thrown: unknown;
    try {
      enforceLaunchGate(request('/products/lightboard?ref=ig'), env());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get('Location')).toBe('/?ref=ig');
    expect(() => enforceLaunchGate(request('/'), env())).not.toThrow();
  });
});

describe('tokensMatch', () => {
  it('compares equal-length strings exactly', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(tokensMatch(undefined, 'abc')).toBe(false);
    expect(tokensMatch(123, 123)).toBe(false);
  });
});
