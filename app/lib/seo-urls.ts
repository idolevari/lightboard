/**
 * Pure URL helpers shared between the server SEO builders (which run in
 * loaders) and the root `meta` export (which runs on both server and client).
 *
 * No server-only modules here — anything else lives in `~/lib/.server/seo.server`.
 */

import {
  SUPPORTED_LOCALES,
  getLocaleConfig,
  localizedPath,
  type Locale,
} from '~/lib/i18n';

export const SITE_NAME = 'Lightboard';
export const SITE_URL = 'https://lightboard.co.il';

/** Build the alternate hreflang link tags for a given pathname (no locale prefix). */
export function buildAlternates(
  pathnameNoLocale: string,
): Array<{rel: 'alternate'; hrefLang: string; href: string}> {
  return SUPPORTED_LOCALES.map((locale) => ({
    rel: 'alternate' as const,
    hrefLang: getLocaleConfig(locale).htmlLang,
    href: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
  }));
}

/** Absolute canonical URL helper for a localized path. */
export function absoluteUrl(
  pathnameNoLocale: string,
  locale: Locale,
): string {
  return `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`;
}
