/**
 * Pure URL + meta helpers shared between the server SEO builders (which run
 * in loaders) and the route `meta` exports (which run on both server and
 * client). No server-only modules here — anything else lives in
 * `~/lib/.server/seo.server`.
 */

import {getSeoMeta} from '@shopify/hydrogen';
import type {MetaDescriptor} from 'react-router';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleConfig,
  localizedPath,
  type Locale,
} from '~/lib/i18n';

export const SITE_NAME = 'Lightboard';
export const SITE_URL = 'https://lightboard.co.il';

/** Any of these in a page title means the brand is already there. */
const BRAND_IN_TITLE = /lightboard|ליטבורד|לייטבורד/i;

const OG_LOCALE: Record<Locale, string> = {he: 'he_IL', en: 'en_IL'};

type GetSeoMetaInput = Parameters<typeof getSeoMeta>[0];
export type SeoOverrides = NonNullable<GetSeoMetaInput>;

/** Absolute canonical URL helper for a localized path. The Hebrew homepage
 *  is `https://lightboard.co.il/` (with the slash) everywhere. */
export function absoluteUrl(pathnameNoLocale: string, locale: Locale): string {
  return `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`;
}

/** Build the alternate hreflang link tags for a given pathname (no locale prefix). */
export function buildAlternates(
  pathnameNoLocale: string,
): Array<{rel: 'alternate'; hrefLang: string; href: string}> {
  return [
    ...SUPPORTED_LOCALES.map((locale) => ({
      rel: 'alternate' as const,
      hrefLang: getLocaleConfig(locale).htmlLang,
      href: absoluteUrl(pathnameNoLocale, locale),
    })),
    // Hebrew is the default experience.
    {
      rel: 'alternate' as const,
      hrefLang: 'x-default',
      href: absoluteUrl(pathnameNoLocale, DEFAULT_LOCALE),
    },
  ];
}

/**
 * Returns React Router meta descriptors for the alternate hreflang `<link>`
 * tags (he, en, x-default). Every route's `meta` export needs to emit these
 * because RR's meta functions override rather than merge with parent
 * matches' output.
 */
export function alternateLinks(
  pathnameNoLocale: string | undefined | null,
): Array<MetaDescriptor> {
  if (!pathnameNoLocale) return [];
  return buildAlternates(pathnameNoLocale).map((link) => ({
    tagName: 'link' as const,
    ...link,
  }));
}

type MaybeRootMatch = {data?: unknown} | null | undefined;

type RootMetaData = {
  seo?: unknown;
  pathnameNoLocale?: string | null;
  locale?: Locale;
} | null;

function mimeFromUrl(url: string): string | null {
  const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url.split('?')[0] ?? '')?.[1];
  switch (ext?.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return null;
  }
}

/**
 * Clean up Hydrogen's `getSeoMeta` output:
 *  - drop the "| Lightboard" suffix when the page title already names the
 *    brand (no "Lightboard | Lightboard");
 *  - keep the canonical of the homepage identical to its hreflang URL
 *    (`https://lightboard.co.il/`; Hydrogen strips the slash);
 *  - fix `og:image:type` (Hydrogen guesses jpeg for Shopify CDN URLs with a
 *    query string) or drop it when the type is unknown.
 */
function tidy(meta: Array<MetaDescriptor>): Array<MetaDescriptor> {
  const suffix = ` | ${SITE_NAME}`;
  let imageUrl: string | null = null;
  const out: Array<MetaDescriptor> = [];
  for (const tag of meta) {
    const t = tag as Record<string, unknown>;
    if (typeof t.title === 'string') {
      out.push({title: dedupeBrand(t.title, suffix)});
      continue;
    }
    if (t.property === 'og:title' || t.property === 'twitter:title') {
      out.push({...t, content: dedupeBrand(String(t.content), suffix)});
      continue;
    }
    if (t.rel === 'canonical' && t.href === SITE_URL) {
      out.push({...t, href: `${SITE_URL}/`});
      continue;
    }
    if (t.property === 'og:url' && t.content === SITE_URL) {
      out.push({...t, content: `${SITE_URL}/`});
      continue;
    }
    if (t.property === 'og:image:url') imageUrl = String(t.content);
    if (t.property === 'og:image:type') {
      const mime = imageUrl ? mimeFromUrl(imageUrl) : null;
      if (mime) out.push({...t, content: mime});
      continue;
    }
    out.push(tag);
  }
  return out;
}

function dedupeBrand(title: string, suffix: string): string {
  if (!title.endsWith(suffix)) return title;
  const head = title.slice(0, -suffix.length);
  return BRAND_IN_TITLE.test(head) ? head : title;
}

/**
 * Standard meta builder for a route: merge the root SEO config with the
 * current route's SEO config via Hydrogen's `getSeoMeta`, then append the
 * hreflang links and the Open Graph / Twitter extras. Use this in every
 * route's `meta` export.
 *
 * `overrides` is merged last (e.g. a gift-intent title on `/`, or
 * `robots: {noIndex: true}` on utility pages). `ogType` defaults to
 * "website"; `extra` adds raw descriptors (e.g. `product:price:amount`).
 *
 * The `matches` arg is typed loosely because React Router's generated meta
 * argument type makes each match element a discriminated union over every
 * route id, which is too narrow to pass through a shared helper.
 */
export function routeMeta(args: {
  matches: ReadonlyArray<MaybeRootMatch>;
  data?: unknown;
  overrides?: SeoOverrides;
  ogType?: string;
  extra?: Array<MetaDescriptor>;
}): Array<MetaDescriptor> {
  const rootMatchData = (args.matches[0]?.data ?? null) as RootMetaData;
  const routeData = (args.data ?? null) as {seo?: unknown} | null;
  const rootSeoConfig = (rootMatchData?.seo ?? undefined) as GetSeoMetaInput;
  const routeSeoConfig = (routeData?.seo ?? undefined) as GetSeoMetaInput;
  const baseMeta = tidy(
    getSeoMeta(rootSeoConfig, routeSeoConfig, args.overrides) ?? [],
  );
  const alternates = alternateLinks(rootMatchData?.pathnameNoLocale ?? null);
  const locale = rootMatchData?.locale ?? DEFAULT_LOCALE;
  const og: Array<MetaDescriptor> = [
    {property: 'og:site_name', content: SITE_NAME},
    {property: 'og:type', content: args.ogType ?? 'website'},
    {property: 'og:locale', content: OG_LOCALE[locale] ?? OG_LOCALE.he},
    ...SUPPORTED_LOCALES.filter((l) => l !== locale).map((l) => ({
      property: 'og:locale:alternate',
      content: OG_LOCALE[l],
    })),
    {name: 'twitter:card', content: 'summary_large_image'},
  ];
  return [...baseMeta, ...alternates, ...og, ...(args.extra ?? [])];
}

/** `robots: noindex, follow` for utility pages (cart, search, account…). */
export const NO_INDEX: SeoOverrides = {robots: {noIndex: true, noFollow: false}};

/** Locale of the current request, from the root match. */
export function metaLocale(matches: ReadonlyArray<MaybeRootMatch>): Locale {
  return (
    (matches[0]?.data as RootMetaData)?.locale ?? DEFAULT_LOCALE
  );
}
