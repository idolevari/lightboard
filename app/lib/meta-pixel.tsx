import {useAnalytics} from '@shopify/hydrogen';
import {useEffect} from 'react';

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
 * Inline base pixel snippet. Renders once in <head>. Fires the initial
 * PageView; SPA navigations are tracked by <MetaPixel /> via Hydrogen's
 * page_viewed event.
 */
export function MetaPixelScript({pixelId, nonce}: MetaPixelScriptProps) {
  if (!pixelId) return null;
  const snippet = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
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

/**
 * Subscribes to Hydrogen's analytics events and forwards them to Meta.
 * Must be rendered inside <Analytics.Provider>.
 */
export function MetaPixel() {
  const {subscribe} = useAnalytics();

  useEffect(() => {
    subscribe('page_viewed', () => {
      track('PageView');
    });

    subscribe('product_viewed', ({products}) => {
      const product = products?.[0];
      if (!product) return;
      track('ViewContent', productPayload(product));
    });

    subscribe('collection_viewed', ({collection}) => {
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
      if (!searchTerm) return;
      track('Search', {search_string: searchTerm});
    });

    subscribe('product_added_to_cart', ({currentLine}) => {
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
  }, [subscribe]);

  return null;
}
