import {useAnalytics} from '@shopify/hydrogen';
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

/**
 * Loads the fbq SDK shim. Does NOT call fbq('init') or fbq('track') —
 * those are gated on visitor marketing consent and fired from <MetaPixel />
 * after Shopify's Customer Privacy API confirms consent.
 *
 * Loading the shim itself before consent is safe: it only sets up
 * window.fbq with a no-op queue. Network calls to facebook.com/tr only
 * happen when fbq('init'|'track', ...) is called.
 */
export function MetaPixelScript({pixelId, nonce}: MetaPixelScriptProps) {
  if (!pixelId) return null;
  const snippet = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`;
  return (
    <script
      nonce={nonce}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: snippet}}
    />
  );
}

function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  window.fbq('track', event, params);
}

function trackCustom(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
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
 * fbq('init', pixelId) and the initial PageView fire ONCE, only after
 * Shopify's Customer Privacy API confirms marketing consent. Subsequent
 * analytics events are also gated on the same consent state via a ref
 * read inside each callback — no events leak before consent.
 *
 * Implementation note: Hydrogen's `subscribe` returns void (no
 * unsubscribe), so we subscribe once and gate inside each callback.
 * Consent state is tracked with a ref so subscription callbacks see
 * the latest value without re-subscribing.
 */
export function MetaPixel({pixelId}: MetaPixelProps) {
  const {subscribe, customerPrivacy} = useAnalytics();
  const [consented, setConsented] = useState(false);
  const consentRef = useRef(false);
  const initRef = useRef(false);
  const subscribedRef = useRef(false);
  // Timestamp of last PageView we sent — used to dedupe Hydrogen's queued
  // page_viewed flush that lands right after init fires PageView.
  const lastPageViewAtRef = useRef<number>(0);

  // Keep the ref in sync so subscribe callbacks always read latest.
  useEffect(() => {
    consentRef.current = consented;
  }, [consented]);

  // Detect when marketing consent is granted. Hydrogen's customerPrivacy
  // API is loaded asynchronously and exposed via the analytics context
  // once ready. Poll briefly until it appears and reports marketing
  // tracking is allowed. The polling stops as soon as consent is granted
  // (safe default: stays off forever otherwise).
  useEffect(() => {
    if (!pixelId) return;
    if (typeof window === 'undefined') return;

    const check = () => {
      const cp = customerPrivacy ?? (
        (window as unknown as {
          Shopify?: {
            customerPrivacy?: {
              marketingAllowed?: () => boolean;
            };
          };
        }).Shopify?.customerPrivacy ?? null
      );
      const allowed = cp?.marketingAllowed?.() ?? false;
      if (allowed) {
        setConsented(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    // Re-check whenever the visitor records a consent decision.
    const onConsentCollected = () => {
      check();
    };
    document.addEventListener('visitorConsentCollected', onConsentCollected);

    // Fallback poll in case the event fires before our listener is
    // attached, or the API only becomes ready after Provider mounts.
    const interval = window.setInterval(() => {
      if (check()) {
        window.clearInterval(interval);
      }
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

  // Fire fbq('init', ...) + initial PageView once, after consent. This
  // guarantees a landing PageView even if Hydrogen flushes its queued
  // page_viewed before our subscription callback can read consent. The
  // page_viewed subscription below dedupes by checking how long ago init
  // fired and skipping the duplicate flush.
  useEffect(() => {
    if (!consented || !pixelId || initRef.current) return;
    if (typeof window === 'undefined') return;
    if (typeof window.fbq !== 'function') return;
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    initRef.current = true;
    lastPageViewAtRef.current = Date.now();
  }, [consented, pixelId]);

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
