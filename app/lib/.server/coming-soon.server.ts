/**
 * Launch-gate helpers.
 *
 * When `env.COMING_SOON === 'true'`:
 *   - Public visitors see /components/ComingSoon and cannot reach any other
 *     route loader (each customer-facing layout route enforces the gate).
 *   - Visitors holding a valid `lb_preview` cookie bypass the gate. The cookie
 *     is set by /preview?token=<env.PREVIEW_TOKEN> and its value is
 *     HMAC-SHA256(SESSION_SECRET, "lb_preview:" + PREVIEW_TOKEN), so it can't
 *     be forged without both secrets, and rotating either one revokes every
 *     issued bypass cookie.
 *   - Localhost dev servers always bypass so `npm run dev` works.
 *
 * The gate checks are synchronous (they run inside loaders), but WebCrypto
 * HMAC is async, so the expected cookie value is computed once per worker
 * isolate by primePreviewCookie() (awaited in createHydrogenRouterContext)
 * and cached here. If it hasn't been primed, the bypass fails closed.
 */

const PREVIEW_COOKIE = 'lb_preview';
const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

type PreviewSecrets = {SESSION_SECRET?: string; PREVIEW_TOKEN?: string};

let primedFor: string | null = null;
let expectedPreviewValue: string | null = null;

function secretsKey(env: PreviewSecrets): string | null {
  if (!env?.SESSION_SECRET || !env?.PREVIEW_TOKEN) return null;
  return `${env.SESSION_SECRET}\u0000${env.PREVIEW_TOKEN}`;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/**
 * Compute (once per isolate / secret pair) the only cookie value that
 * bypasses the gate. Cheap no-op when the gate is off.
 */
export async function primePreviewCookie(env: Env): Promise<void> {
  if (env?.COMING_SOON !== 'true') return;
  const key = secretsKey(env);
  if (!key) {
    primedFor = null;
    expectedPreviewValue = null;
    return;
  }
  if (primedFor === key && expectedPreviewValue) return;
  expectedPreviewValue = await hmacHex(
    env.SESSION_SECRET,
    `lb_preview:${env.PREVIEW_TOKEN}`,
  );
  primedFor = key;
}

/** Signed bypass value that /preview sets as the cookie. */
export async function getPreviewCookieValue(env: Env): Promise<string | null> {
  const key = secretsKey(env);
  if (!key) return null;
  return hmacHex(env.SESSION_SECRET, `lb_preview:${env.PREVIEW_TOKEN}`);
}

export function isLocalhost(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function hasPreviewCookie(request: Request, env: Env): boolean {
  const key = secretsKey(env);
  if (!key || primedFor !== key || !expectedPreviewValue) return false;
  const expected = expectedPreviewValue;
  const cookie = request.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((c) => c.trim())
    .some(
      (c) =>
        c.startsWith(`${PREVIEW_COOKIE}=`) &&
        tokensMatch(c.slice(PREVIEW_COOKIE.length + 1), expected),
    );
}

export function isLaunchGateActive(request: Request, env: Env): boolean {
  if (env?.COMING_SOON !== 'true') return false;
  if (isLocalhost(request)) return false;
  if (hasPreviewCookie(request, env)) return false;
  return true;
}

/**
 * Throw a Response that React Router will render via the nearest
 * ErrorBoundary. The root App() checks for showComingSoon in loader data and
 * renders the ComingSoon component when present, so child routes need a way
 * to short-circuit without leaking their own data. We throw a 200 redirect
 * to "/" so the root layout can run normally and render ComingSoon.
 */
export function enforceLaunchGate(request: Request, env: Env): void {
  if (!isLaunchGateActive(request, env)) return;
  // Strip any nested path so the gate hides what page the visitor was after.
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '') return;
  throw redirectToRoot(url);
}

function redirectToRoot(url: URL): Response {
  return new Response(null, {
    status: 302,
    headers: {Location: '/' + url.search},
  });
}

/**
 * Constant-time string compare. Both inputs must be strings.
 */
export function tokensMatch(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function buildPreviewCookie(value: string): string {
  const parts = [
    `${PREVIEW_COOKIE}=${value}`,
    'Path=/',
    `Max-Age=${PREVIEW_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}
