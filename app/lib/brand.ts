/**
 * Helpers for deriving brand contact links.
 *
 * Business data (phone, email, instagram, legal name, address) lives entirely
 * in Shopify shop metafields under the `business` namespace — see
 * HEADER_QUERY. The merchant edits everything from Shopify Admin → Settings →
 * Custom data → Shop, with zero code deploy needed.
 *
 * Components read via `useBusiness()` so format helpers and components share
 * a single shape regardless of where the data lives.
 */
import {useRouteLoaderData} from 'react-router';

export type Business = {
  phone: string;
  phoneDisplay: string;
  email: string;
  instagram: string;
  legalName: string;
  address: string;
};

function digits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Pretty-print a stored canonical phone (e.g. "+972-55-720-9448") into the
 * Israeli local format ("055-7209448"). For non-IL numbers, returns the
 * stored value unchanged.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const d = digits(phone);
  if (d.startsWith('972') && d.length === 12) {
    // 972 55 7209448 → 055-7209448
    return `0${d.slice(3, 5)}-${d.slice(5)}`;
  }
  return phone ?? '';
}

/**
 * Returns a unified business object reading from shop metafields.
 */
export function useBusiness(): Business {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- root loader shape is awkward to thread through; narrowed via optional chaining
  const root = useRouteLoaderData('root') as any;
  const shop = root?.header?.shop;
  const phone = shop?.phone?.value ?? '';
  return {
    phone,
    phoneDisplay: formatPhoneDisplay(phone),
    email: shop?.email?.value ?? '',
    instagram: shop?.instagram?.value ?? '',
    legalName: shop?.legalName?.value ?? '',
    address: shop?.businessAddress?.value ?? '',
  };
}

export function whatsappHref(
  business: Pick<Business, 'phone'> | null | undefined,
  prefillText?: string,
): string | null {
  const number = digits(business?.phone);
  if (!number) return null;
  const query = prefillText
    ? `?text=${encodeURIComponent(prefillText)}`
    : '';
  return `https://wa.me/${number}${query}`;
}

export function telHref(
  business: Pick<Business, 'phone'> | null | undefined,
): string | null {
  const number = digits(business?.phone);
  return number ? `tel:+${number}` : null;
}

export function mailtoHref(
  business: Pick<Business, 'email'> | null | undefined,
): string | null {
  return business?.email ? `mailto:${business.email}` : null;
}
