/**
 * Launch-gate helpers.
 *
 * When `env.COMING_SOON === 'true'`:
 *   - Public visitors see /components/ComingSoon and cannot reach any other
 *     route loader (each customer-facing layout route enforces the gate).
 *   - Visitors holding the `lb_preview=1` cookie bypass the gate. The cookie
 *     is set by /preview?token=<env.PREVIEW_TOKEN>.
 *   - Localhost dev servers always bypass so `npm run dev` works.
 */

const PREVIEW_COOKIE = 'lb_preview';
const PREVIEW_COOKIE_VALUE = '1';
const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function isLocalhost(request) {
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function hasPreviewCookie(request) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((c) => c.trim())
    .some((c) => c === `${PREVIEW_COOKIE}=${PREVIEW_COOKIE_VALUE}`);
}

export function isLaunchGateActive(request, env) {
  if (env?.COMING_SOON !== 'true') return false;
  if (isLocalhost(request)) return false;
  if (hasPreviewCookie(request)) return false;
  return true;
}

/**
 * Throw a Response that React Router will render via the nearest
 * ErrorBoundary. The root App() checks for showComingSoon in loader data and
 * renders the ComingSoon component when present, so child routes need a way
 * to short-circuit without leaking their own data. We throw a 200 redirect
 * to "/" so the root layout can run normally and render ComingSoon.
 */
export function enforceLaunchGate(request, env) {
  if (!isLaunchGateActive(request, env)) return;
  // Strip any nested path so the gate hides what page the visitor was after.
  const url = new URL(request.url);
  if (url.pathname === '/' || url.pathname === '') return;
  throw redirectToRoot(url);
}

function redirectToRoot(url) {
  return new Response(null, {
    status: 302,
    headers: {Location: '/' + url.search},
  });
}

/**
 * Constant-time string compare. Both inputs must be strings.
 */
export function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function buildPreviewCookie() {
  const parts = [
    `${PREVIEW_COOKIE}=${PREVIEW_COOKIE_VALUE}`,
    'Path=/',
    `Max-Age=${PREVIEW_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}
