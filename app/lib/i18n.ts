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

import type {
  CountryCode,
  LanguageCode,
} from '@shopify/hydrogen/storefront-api-types';
import enDict from '~/lib/i18n/en.json';
import heDict from '~/lib/i18n/he.json';

export type Locale = 'he' | 'en';

export type LocaleConfig = {
  lang: LanguageCode;
  country: CountryCode;
  dir: 'rtl' | 'ltr';
  htmlLang: string;
  label: string;
  shortLabel: string;
};

export const DEFAULT_LOCALE: Locale = 'he';

export const LOCALES: Record<Locale, LocaleConfig> = {
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

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as ReadonlyArray<Locale>;

// The HE dictionary is the canonical reference shape. EN has the same top-level
// keys but some sub-records (e.g. product.optionLabels) intentionally omit
// entries that fall back to the Shopify-provided English values, so we widen
// nested records to plain Record<string, ...> rather than the strict literal
// shape derived from heDict.
type LooseDict<T> = T extends Record<string, string>
  ? Record<string, string>
  : T extends object
    ? {[K in keyof T]: LooseDict<T[K]>}
    : T;

export type Dictionary = LooseDict<typeof heDict>;

const DICTIONARIES: Record<Locale, Dictionary> = {
  he: heDict as Dictionary,
  en: enDict as Dictionary,
};

/**
 * Extract the locale prefix from a pathname.
 * Returns {locale, rest} where rest is the pathname without the prefix.
 * Unknown prefixes yield the default locale and the original pathname.
 */
export function parseLocaleFromPath(
  pathname: string,
): {locale: Locale; rest: string} {
  const [, first, ...rest] = pathname.split('/');
  if (
    first &&
    (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(first) &&
    first !== DEFAULT_LOCALE
  ) {
    return {locale: first as Locale, rest: '/' + rest.join('/')};
  }
  return {locale: DEFAULT_LOCALE, rest: pathname};
}

/**
 * Prepend the locale prefix to a path, or strip it if the locale is the default.
 * Always returns a pathname starting with '/'.
 */
export function localizedPath(
  path: string,
  locale: Locale | null | undefined,
): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!locale || locale === DEFAULT_LOCALE) return normalized;
  return `/${locale}${normalized === '/' ? '' : normalized}`;
}

/**
 * Toggle a path between locales, preserving the underlying route.
 * Used by the header language switcher.
 */
export function swapLocaleInPath(
  pathname: string,
  targetLocale: Locale,
): string {
  const {rest} = parseLocaleFromPath(pathname);
  return localizedPath(rest || '/', targetLocale);
}

export function getLocaleConfig(locale: Locale | string): LocaleConfig {
  return LOCALES[locale as Locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function getDictionary(locale: Locale | string): Dictionary {
  return DICTIONARIES[locale as Locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Detect the locale for an incoming request from its URL.
 * Safe to call on the server.
 */
export function detectLocaleFromRequest(request: Request): Locale {
  const url = new URL(request.url);
  return parseLocaleFromPath(url.pathname).locale;
}
