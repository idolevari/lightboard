// app/lib/.server/url.server.ts

/**
 * Detect WooCommerce-migration URL artifacts (trailing %20, trailing whitespace,
 * trailing slashes after handles that shouldn't have them) and 301-redirect to
 * the canonical URL. Returns a Response if a redirect is needed, otherwise null.
 *
 * Usage in a route loader:
 *
 *   export async function loader({request, params, context}: Route.LoaderArgs) {
 *     const redirectResponse = checkForTrailingEncodedSpaces(request);
 *     if (redirectResponse) throw redirectResponse;
 *     // ... existing loader logic
 *   }
 *
 * Throwing a Response is React Router's idiomatic short-circuit — it bypasses
 * subsequent data fetching cleanly.
 */
export function checkForTrailingEncodedSpaces(request: Request): Response | null {
  const url = new URL(request.url);
  const original = url.pathname;
  let next = original;

  // Strip trailing encoded spaces (any number of them).
  next = next.replace(/(%20)+$/i, '');
  // Strip trailing whitespace (rare; some clients pass raw spaces).
  next = next.replace(/\s+$/, '');
  // Strip trailing slashes from non-root paths.
  if (next.length > 1) {
    next = next.replace(/\/+$/, '');
  }

  if (next !== original) {
    url.pathname = next;
    return new Response(null, {
      status: 301,
      headers: {Location: url.toString()},
    });
  }
  return null;
}
