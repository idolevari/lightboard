/**
 * Locale configuration for the Lightboard storefront.
 *
 * URL convention
 *   /         → Hebrew (default, no prefix)
 *   /en/...   → English
 *
 * Shopify Markets is configured with a single IL market and two languages (HE, EN),
 * so Storefront API @inContext queries return the right translations automatically.
 */

import enDict from '~/lib/i18n/en.json';
import heDict from '~/lib/i18n/he.json';

export const DEFAULT_LOCALE = 'he';

export const LOCALES = {
  he: {
    lang: 'HE',
    country: 'IL',
    dir: 'rtl',
    htmlLang: 'he',
    label: 'עברית',
    shortLabel: 'HE',
  },
  en: {
    lang: 'EN',
    country: 'IL',
    dir: 'ltr',
    htmlLang: 'en',
    label: 'English',
    shortLabel: 'EN',
  },
};

export const SUPPORTED_LOCALES = Object.keys(LOCALES);

const DICTIONARIES = {he: heDict, en: enDict};

/**
 * Extract the locale prefix from a pathname.
 * Returns {locale, rest} where rest is the pathname without the prefix.
 * Unknown prefixes yield the default locale and the original pathname.
 */
export function parseLocaleFromPath(pathname) {
  const [, first, ...rest] = pathname.split('/');
  if (first && SUPPORTED_LOCALES.includes(first) && first !== DEFAULT_LOCALE) {
    return {locale: first, rest: '/' + rest.join('/')};
  }
  return {locale: DEFAULT_LOCALE, rest: pathname};
}

/**
 * Prepend the locale prefix to a path, or strip it if the locale is the default.
 * Always returns a pathname starting with '/'.
 */
export function localizedPath(path, locale) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!locale || locale === DEFAULT_LOCALE) return normalized;
  return `/${locale}${normalized === '/' ? '' : normalized}`;
}

/**
 * Toggle a path between locales, preserving the underlying route.
 * Used by the header language switcher.
 */
export function swapLocaleInPath(pathname, targetLocale) {
  const {rest} = parseLocaleFromPath(pathname);
  return localizedPath(rest || '/', targetLocale);
}

export function getLocaleConfig(locale) {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function getDictionary(locale) {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Detect the locale for an incoming request from its URL.
 * Safe to call on the server.
 */
export function detectLocaleFromRequest(request) {
  const url = new URL(request.url);
  return parseLocaleFromPath(url.pathname).locale;
}
