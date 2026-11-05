/**
 * 301s from the old WordPress + WooCommerce site (lightboard.co.il before
 * the Hydrogen move) to the closest live page.
 *
 * Applied in server.ts only when the app returns 404, and before Shopify's
 * own URL Redirects (`storefrontRedirect`), so a live route is never
 * shadowed. Slugs come from `vxd_posts` (post_status = 'publish') in the WP
 * backup: 29 products, 13 pages, 5 product categories.
 *
 * When one of the remaining WooCommerce products is migrated, reuse its old
 * slug (transliterated if Hebrew) as the Shopify handle and move it from
 * PENDING_PRODUCTS to PAGES with its `/products/<handle>` target.
 */

/** Exact old paths (decoded, no trailing slash) → new path. */
const PAGES: Record<string, string> = {
  // Products already on Shopify
  '/product/lightboard': '/products/lightboard',
  // Shop and account
  '/shop': '/collections/all',
  '/checkout': '/cart',
  '/my-account': '/account',
  '/wishlist': '/collections/all',
  // Content pages
  '/אודות': '/#story',
  '/about': '/#story',
  '/צרו-קשר': '/pages/contact',
  '/contact': '/pages/contact',
  '/טופס': '/pages/contact',
  '/תקנון-האתר': '/policies/terms-of-service',
  '/תקנון': '/policies/terms-of-service',
  '/מדיניות-פרטיות': '/policies/privacy-policy',
  '/privacy-policy': '/policies/privacy-policy',
  '/refund_returns': '/policies/refund-policy',
  '/הצהרת-נגישות': '/pages/accessibility',
  '/עמוד-הבית': '/',
  '/גלשני-עץ-דקורטיביים': '/products/lightboard',
  '/coming-soon': '/',
  '/thanks': '/',
  '/fail': '/',
  // WP feeds
  '/feed': '/',
  '/comments/feed': '/',
};

/** WooCommerce products not on Shopify yet. They redirect to the catalogue
 *  (as does any other /product/<slug>); listed so migration can be tracked. */
export const PENDING_PRODUCTS: ReadonlySet<string> = new Set([
  'picprint-square',
  'surf-prints',
  'fairy-lights',
  'wooden-surfboard',
  'פיתוח-תמונות-פולארויד',
  'classic-surfboard',
  'led-clips',
  'shaka-hand',
  'pray-for-surf',
  'תמונות-חוף-וגלישה-לעיצוב-החדר',
  'surfer-print',
  'gone-surfing',
  'california',
  'מתלה-בגדים-גלשן-עץ',
  'sun-waves',
  'pineapple',
  'מתלה-סקייטבורד',
  'wave',
  'surfboard-family-sign',
  'hang-ten',
  'beach-sunset',
  'printboard-palms-trees',
  'printboard-sunset-session',
  'printboard-surfer',
  'printboard-beach-waves',
  'metal-surfboard',
  'palms-trees',
  'printboard-waves',
]);

function redirectTo(url: URL, to: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      Location: new URL(to, url.origin).toString(),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Returns a 301 Response for a known legacy URL, or null. GET/HEAD only.
 */
export function legacyRedirect(request: Request): Response | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  // WP shortlinks (/?product=…, /?p=…) land on the live homepage (200), so
  // they never reach this 404 hook; they are not worth a pre-routing check.

  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  path = path.normalize('NFC').replace(/\/+$/, '') || '/';
  const lower = path.toLowerCase();

  const exact = PAGES[path] ?? PAGES[lower];
  if (exact) return redirectTo(url, exact);

  if (lower.startsWith('/my-account/')) return redirectTo(url, '/account');

  // /product/<slug>: migrated products are in PAGES above. Pending and
  // unknown slugs go to the catalogue, which beats a 404.
  const product = /^\/product\/([^/]+)$/.exec(path)?.[1];
  if (product) return redirectTo(url, '/collections/all');

  if (/^\/product-(category|tag)\//.test(lower)) {
    return redirectTo(url, '/collections/all');
  }

  return null;
}
