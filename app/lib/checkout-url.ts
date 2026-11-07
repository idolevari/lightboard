/**
 * Checkout runs on Shopify, on the Online Store's primary domain. That is
 * checkout.lightboard.co.il (set in Admin → Settings → Domains), but the
 * Storefront API can keep returning checkout links on the store's
 * *.myshopify.com host. Customers leaving lightboard.co.il for a myshopify
 * address looks like a scam, so links are moved to the branded domain.
 * The same checkout path works on both hosts.
 */
export const CHECKOUT_DOMAIN = 'checkout.lightboard.co.il';

export function brandCheckoutUrl(url: string): string;
export function brandCheckoutUrl(
  url: string | null | undefined,
): string | null | undefined;
export function brandCheckoutUrl(url: string | null | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.myshopify.com')) return url;
    parsed.hostname = CHECKOUT_DOMAIN;
    return parsed.toString();
  } catch {
    return url;
  }
}
