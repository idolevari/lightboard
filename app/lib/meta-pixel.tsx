import {useAnalytics, useNonce} from '@shopify/hydrogen';
import {useLocation} from 'react-router';
import {hasExplicitMarketingConsent} from '~/lib/consent';
import {useEffect, useRef, useState} from 'react';

const DEFAULT_CURRENCY = 'ILS';

declare global {
  interface Window {
    fbq?: ((...args: Array<unknown>) => void) & {
      queue?: Array<unknown>;
      loaded?: boolean;
      version?: string;
    };
  }
}

type MetaPixelScriptProps = {
  pixelId: string | null | undefined;
  nonce?: string;
};

const FBEVENTS_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const FBEVENTS_SCRIPT_ID = 'meta-pixel-fbevents';

/**
 * Inline queue stub ONLY: defines `window.fbq` so early calls are buffered.
 * It makes no network request. Meta's SDK (fbevents.js) is injected by
 * <MetaPixel /> via loadFbevents() only after the visitor explicitly grants
 * marketing consent, so nothing reaches Meta (no request, no _fbp cookie)
 * before that.
 */
export function MetaPixelScript({pixelId, nonce}: MetaPixelScriptProps) {
  if (!pixelId) return null;
  const snippet = `!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);`;
  return (
    <script
      nonce={nonce}
      // React 18 strips the `nonce` attribute from SSR HTML for security, then
      // re-applies it on the client. The hydration reconciler flags the diff
      // ("Server: null Client: <nonce>") even though the nonce is correctly
      // attached at runtime. Silencing the benign mismatch.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{__html: snippet}}
    />
  );
}

/** Inject Meta's SDK once. Only call after explicit marketing consent. */
function loadFbevents(nonce: string | undefined): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FBEVENTS_SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = FBEVENTS_SCRIPT_ID;
  script.async = true;
  script.src = FBEVENTS_SRC;
  if (nonce) script.nonce = nonce;
  document.head.appendChild(script);
}

/**
 * Pages that render the signed-in customer's own email/name/address. Meta's
 * Automatic Advanced Matching scrapes and hashes such values with every
 * event, so we never init or forward events while on these paths.
 */
function isSensitivePath(): boolean {
  if (typeof window === 'undefined') return true;
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?account(?:\/|$)/i.test(
    window.location.pathname,
  );
}

function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  if (isSensitivePath()) return;
  window.fbq('track', event, params);
}

function trackCustom(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  if (isSensitivePath()) return;
  window.fbq('trackCustom', event, params);
}

// Loose product/line shape read off analytics payloads — Hydrogen's strict
// types vary between product_viewed (StorefrontProduct) and
// product_added_to_cart (CartLine.merchandise.product), and we read defensively
// with optional chaining instead of threading the union through.
type AnalyticsProduct = {
  productGid?: string;
  variantId?: string;
  id?: string;
  title?: string;
  price?: string | number;
  currency?: string;
  priceV2?: {amount?: string | number; currencyCode?: string};
  quantity?: number;
};

function productPayload(product: AnalyticsProduct | null | undefined) {
  const rawPrice = product?.price ?? product?.priceV2?.amount;
  const currency =
    product?.currency ?? product?.priceV2?.currencyCode ?? DEFAULT_CURRENCY;
  return {
    content_ids: [product?.productGid ?? product?.variantId ?? product?.id],
    content_name: product?.title,
    content_type: 'product',
    value: rawPrice != null ? parseFloat(String(rawPrice)) : undefined,
    currency,
  };
}

function cartPayload(
  products: Array<AnalyticsProduct> | null | undefined,
) {
  if (!Array.isArray(products) || products.length === 0) return null;
  const currency =
    products[0]?.currency ??
    products[0]?.priceV2?.currencyCode ??
    DEFAULT_CURRENCY;
  const value = products.reduce<number>((sum, p) => {
    const price = parseFloat(
      String(p?.price ?? p?.priceV2?.amount ?? 0),
    );
    const qty = p?.quantity ?? 1;
    return sum + (Number.isFinite(price) ? price * qty : 0);
  }, 0);
  return {
    content_ids: products.map(
      (p) => p?.productGid ?? p?.variantId ?? p?.id,
    ),
    content_type: 'product',
    contents: products.map((p) => ({
      id: p?.productGid ?? p?.variantId ?? p?.id,
      quantity: p?.quantity ?? 1,
    })),
    value: Number(value.toFixed(2)),
    currency,
  };
}

type MetaPixelProps = {pixelId: string | null | undefined};

/**
 * Subscribes to Hydrogen's analytics events and forwards them to Meta.
 * Must be rendered inside <Analytics.Provider>.
 *
 * Consent model (strict opt-in):
 *   - Nothing Meta-related loads until the visitor explicitly accepts
 *     marketing cookies in Shopify's privacy banner
 *     (`currentVisitorConsent().marketing === 'yes'`). `marketingAllowed()`
 *     alone isn't used because Shopify reports it as true for regions where
 *     no banner is configured (e.g. Israel) even though no choice was made.
 *   - On consent: fbevents.js is injected, autoConfig is turned off (no
 *     automatic button/page-metadata scraping), then init + PageView fire.
 *   - If the visitor later withdraws consent (via the banner's preferences
 *     dialog), fbq('consent', 'revoke') stops further sends and events stop
 *     being forwarded.
 *   - Never inits or forwards events on /account pages (customer PII).
 *
 * Implementation note: Hydrogen's `subscribe` returns void (no
 * unsubscribe), so we subscribe once and gate inside each callback.
 * Consent state is tracked with a ref so subscription callbacks see
 * the latest value without re-subscribing.
 */
export function MetaPixel({pixelId}: MetaPixelProps) {
  const {subscribe, customerPrivacy} = useAnalytics();
  const nonce = useNonce();
  const {pathname} = useLocation();
  const [consented, setConsented] = useState(false);
  const consentRef = useRef(false);
  const initRef = useRef(false);
  const subscribedRef = useRef(false);
  // Timestamp of last PageView we sent — used to dedupe Hydrogen's queued
  // page_viewed flush that lands right after init fires PageView.
  const lastPageViewAtRef = useRef<number>(0);

  // Keep the ref in sync so subscribe callbacks always read latest, and tell
  // an already-initialised pixel when consent is withdrawn or re-granted.
  useEffect(() => {
    consentRef.current = consented;
    if (initRef.current && typeof window.fbq === 'function') {
      window.fbq('consent', consented ? 'grant' : 'revoke');
    }
  }, [consented]);

  // Track the visitor's explicit marketing choice. The Customer Privacy API
  // loads asynchronously (customerPrivacy flips from null once ready), and
  // `visitorConsentCollected` fires whenever the visitor saves a choice in
  // the banner or the preferences dialog.
  useEffect(() => {
    if (!pixelId) return;
    if (typeof window === 'undefined') return;

    const check = () => {
      const allowed = hasExplicitMarketingConsent(customerPrivacy);
      setConsented(allowed);
      return allowed;
    };

    check();

    const onConsentCollected = () => {
      check();
    };
    document.addEventListener('visitorConsentCollected', onConsentCollected);

    // Fallback poll in case the API becomes ready before Hydrogen updates the
    // analytics context, or a stored "yes" is only readable a moment later.
    const interval = window.setInterval(() => {
      if (check()) window.clearInterval(interval);
    }, 500);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 10_000);

    return () => {
      document.removeEventListener(
        'visitorConsentCollected',
        onConsentCollected,
      );
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [pixelId, customerPrivacy]);

  // Load the SDK and fire init + the landing PageView once, after consent and
  // outside /account. Re-runs on navigation so a visitor who lands on an
  // account page and then browses on still gets tracked (if consented).
  useEffect(() => {
    if (!consented || !pixelId || initRef.current) return;
    if (typeof window === 'undefined') return;
    if (typeof window.fbq !== 'function') return;
    if (isSensitivePath()) return;
    loadFbevents(nonce);
    window.fbq('set', 'autoConfig', false, pixelId);
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    initRef.current = true;
    lastPageViewAtRef.current = Date.now();
  }, [consented, pixelId, nonce, pathname]);

  // Subscribe to Hydrogen analytics events once. Each callback consults
  // consentRef before forwarding so events stay gated even if consent is
  // granted later.
  useEffect(() => {
    if (subscribedRef.current) return;
    if (!pixelId) return;
    subscribedRef.current = true;

    // The initial page_viewed is handled inline by the consent effect
    // above (which fires fbq('track', 'PageView') on the first consent
    // grant). Subsequent SPA navigations come through here.
    subscribe('page_viewed', () => {
      if (!consentRef.current) return;
      // The init effect fires PageView the moment consent flips; if
      // Hydrogen's queued page_viewed for the same landing page lands
      // within a short window after that, skip it. Subsequent SPA
      // navigations land far outside this window and forward normally.
      if (Date.now() - lastPageViewAtRef.current < 1000) return;
      track('PageView');
      lastPageViewAtRef.current = Date.now();
    });

    subscribe('product_viewed', ({products}) => {
      if (!consentRef.current) return;
      const product = products?.[0];
      if (!product) return;
      track('ViewContent', productPayload(product));
    });

    subscribe('collection_viewed', ({collection}) => {
      if (!consentRef.current) return;
      if (!collection) return;
      // CollectionPayloadDetails exposes {id, handle} from Hydrogen, but some
      // call sites attach a title — read it through a loose cast since we
      // only use it as a fallback display label.
      const title = (collection as {title?: string} | undefined)?.title;
      trackCustom('ViewCategory', {
        content_category: collection?.handle ?? title,
        content_name: title,
      });
    });

    subscribe('search_viewed', ({searchTerm}) => {
      if (!consentRef.current) return;
      if (!searchTerm) return;
      track('Search', {search_string: searchTerm});
    });

    subscribe('product_added_to_cart', ({currentLine}) => {
      if (!consentRef.current) return;
      const product: AnalyticsProduct | null | undefined = currentLine?.merchandise
        ? {
            productGid: currentLine.merchandise.product?.id,
            variantId: currentLine.merchandise.id,
            title: currentLine.merchandise.product?.title,
            price: currentLine.cost?.totalAmount?.amount,
            currency: currentLine.cost?.totalAmount?.currencyCode,
            quantity: currentLine.quantity,
          }
        : (currentLine as AnalyticsProduct | null | undefined);
      track('AddToCart', productPayload(product));
    });

    subscribe('cart_viewed', ({cart}) => {
      if (!consentRef.current) return;
      // cart.lines is BaseCartLineConnection | CartLine[] in Hydrogen's type —
      // normalize both shapes into a flat array of cart line nodes.
      const linesRaw = cart?.lines as
        | {nodes?: Array<unknown>}
        | Array<unknown>
        | undefined;
      const lineNodes: Array<{
        merchandise?: {id?: string; product?: {id?: string; title?: string}};
        cost?: {totalAmount?: {amount?: string; currencyCode?: string}};
        quantity?: number;
      }> = Array.isArray(linesRaw)
        ? (linesRaw as Array<{
            merchandise?: {id?: string; product?: {id?: string; title?: string}};
            cost?: {totalAmount?: {amount?: string; currencyCode?: string}};
            quantity?: number;
          }>)
        : ((linesRaw?.nodes ?? []) as Array<{
            merchandise?: {id?: string; product?: {id?: string; title?: string}};
            cost?: {totalAmount?: {amount?: string; currencyCode?: string}};
            quantity?: number;
          }>);
      const products: Array<AnalyticsProduct> = lineNodes.map((line) => ({
        productGid: line?.merchandise?.product?.id,
        variantId: line?.merchandise?.id,
        title: line?.merchandise?.product?.title,
        price: line?.cost?.totalAmount?.amount,
        currency: line?.cost?.totalAmount?.currencyCode,
        quantity: line?.quantity,
      }));
      const payload = cartPayload(products);
      if (payload) track('InitiateCheckout', payload);
    });
  }, [subscribe, pixelId]);

  return null;
}
