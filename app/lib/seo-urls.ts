/**
 * Pure URL + meta helpers shared between the server SEO builders (which run
 * in loaders) and the route `meta` exports (which run on both server and
 * client). No server-only modules here — anything else lives in
 * `~/lib/.server/seo.server`.
 */

import {getSeoMeta} from '@shopify/hydrogen';
import type {MetaDescriptor} from 'react-router';
import {
  SUPPORTED_LOCALES,
  getLocaleConfig,
  localizedPath,
  type Locale,
} from '~/lib/i18n';

export const SITE_NAME = 'Lightboard';
export const SITE_URL = 'https://lightboard.co.il';

type GetSeoMetaInput = Parameters<typeof getSeoMeta>[0];

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

/**
 * Returns React Router meta descriptors for the alternate hreflang `<link>`
 * tags. Every route's `meta` export needs to emit these because RR's meta
 * functions override rather than merge with parent matches' output.
 */
export function alternateLinks(
  pathnameNoLocale: string | undefined | null,
): Array<MetaDescriptor> {
  if (!pathnameNoLocale) return [];
  return SUPPORTED_LOCALES.map((locale) => ({
    tagName: 'link' as const,
    rel: 'alternate' as const,
    hrefLang: getLocaleConfig(locale).htmlLang,
    href: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
  }));
}

type MaybeRootMatch =
  | {data?: unknown}
  | null
  | undefined;

/**
 * Standard meta builder for a route: merge the root SEO config with the
 * current route's SEO config via Hydrogen's `getSeoMeta`, then append the
 * hreflang `<link rel="alternate">` descriptors. Use this in every route's
 * `meta` export so the hreflangs appear on every page, not just `/`.
 *
 * The `matches` arg is typed loosely because React Router's generated meta
 * argument type makes each match element a discriminated union over every
 * route id, which is too narrow to pass through a shared helper. We
 * structurally pluck `data.seo` and `data.pathnameNoLocale` off the root
 * match.
 */
export function routeMeta(args: {
  matches: ReadonlyArray<MaybeRootMatch>;
  data?: unknown;
}): Array<MetaDescriptor> {
  const rootMatchData =
    (args.matches[0]?.data ?? null) as
      | {seo?: unknown; pathnameNoLocale?: string | null}
      | null;
  const routeData = (args.data ?? null) as {seo?: unknown} | null;
  const rootSeoConfig = (rootMatchData?.seo ?? undefined) as GetSeoMetaInput;
  const routeSeoConfig = (routeData?.seo ?? undefined) as GetSeoMetaInput;
  const baseMeta = getSeoMeta(rootSeoConfig, routeSeoConfig) ?? [];
  const alternates = alternateLinks(rootMatchData?.pathnameNoLocale ?? null);
  return [...baseMeta, ...alternates];
}

/** Absolute canonical URL helper for a localized path. */
export function absoluteUrl(
  pathnameNoLocale: string,
  locale: Locale,
): string {
  return `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`;
}
