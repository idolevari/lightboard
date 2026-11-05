import {useEffect, useState} from 'react';

/**
 * Client helpers around Shopify's Customer Privacy API + privacy banner.
 *
 * The banner itself is loaded by <Analytics.Provider> in root.tsx
 * (`consent.withPrivacyBanner: true`). Which regions see it is configured in
 * Shopify Admin → Settings → Customer privacy → Cookie banner.
 *
 * Footer "Cookie settings" link:
 *
 *   import {openCookiePreferences, useCookiePreferencesAvailable} from '~/lib/consent';
 *
 *   const canOpen = useCookiePreferencesAvailable();
 *   <button type="button" onClick={openCookiePreferences} hidden={!canOpen}>
 *     הגדרות עוגיות
 *   </button>
 */

type ConsentValue = 'yes' | 'no' | '';

type CustomerPrivacyLike = {
  marketingAllowed?: () => boolean;
  currentVisitorConsent?: () => Partial<Record<string, ConsentValue>>;
};

function getCustomerPrivacy(): CustomerPrivacyLike | null {
  if (typeof window === 'undefined') return null;
  return (window.Shopify?.customerPrivacy as CustomerPrivacyLike) ?? null;
}

/**
 * Reopens Shopify's cookie preferences dialog so a visitor can change or
 * withdraw consent. Returns false when the banner script hasn't loaded yet
 * (SSR, ad blockers, or before hydration).
 */
export function openCookiePreferences(): boolean {
  if (typeof window === 'undefined') return false;
  const banner = window.privacyBanner as
    | {showPreferences?: () => void}
    | undefined;
  if (typeof banner?.showPreferences !== 'function') return false;
  banner.showPreferences();
  return true;
}

/**
 * True once Shopify's privacy banner script is ready, so callers can hide a
 * "Cookie settings" control that would otherwise do nothing.
 */
export function useCookiePreferencesAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const check = () => {
      const ok =
        typeof (
          window.privacyBanner as {showPreferences?: unknown} | undefined
        )?.showPreferences === 'function';
      if (ok) setAvailable(true);
      return ok;
    };
    if (check()) return;
    const interval = window.setInterval(() => {
      if (check()) window.clearInterval(interval);
    }, 500);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      15_000,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);
  return available;
}

/**
 * Strict marketing-consent check: the visitor must have explicitly opted in.
 *
 * `marketingAllowed()` alone is not enough: for regions where the Admin
 * banner isn't configured (Israel, by default) Shopify reports `true` with
 * no choice recorded, which would let tracking run without consent.
 */
export function hasExplicitMarketingConsent(
  customerPrivacy?: CustomerPrivacyLike | null,
): boolean {
  const cp = customerPrivacy ?? getCustomerPrivacy();
  if (!cp) return false;
  const marketing = cp.currentVisitorConsent?.()?.marketing;
  return marketing === 'yes' && (cp.marketingAllowed?.() ?? false);
}
