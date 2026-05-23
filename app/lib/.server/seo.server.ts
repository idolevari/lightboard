/**
 * Centralized SEO builders. Each helper returns a Hydrogen `SeoConfig` that
 * can be passed to `getSeoMeta(...)` in a route's `meta` export.
 *
 * The hreflang `<link rel="alternate">` set is emitted via `buildAlternates`
 * from the root meta export so React Router controls the head, not us.
 *
 * JSON-LD payloads are typed with `schema-dts`'s `WithContext<Thing>` so the
 * `@context` literal is preserved end to end.
 */

import type {SeoConfig} from '@shopify/hydrogen';
import type {
  Article,
  BreadcrumbList,
  CollectionPage,
  Offer,
  Organization,
  Product as ProductLd,
  Thing,
  WebSite,
  WithContext,
} from 'schema-dts';
import {getLocaleConfig, localizedPath, type Locale} from '~/lib/i18n';
import {SITE_NAME, SITE_URL} from '~/lib/seo-urls';

const SCHEMA_CONTEXT = 'https://schema.org' as const;

// Hydrogen's SeoConfig['jsonLd'] is `WithContext<Thing> | WithContext<Thing>[]`.
// schema-dts unions like `Organization = OrganizationLeaf | Airline | ... |
// string` are too wide for TS to distribute back into `WithContext<Thing>`
// once the structural type is materialized through a loader round-trip — the
// deeply-nested recursive fields blow up. We accept the type-checked
// per-helper shape but widen it via this alias on the way into `SeoConfig`.
type JsonLd = SeoConfig['jsonLd'];

export type RootSeoInput = {
  locale: Locale;
  pathnameNoLocale: string;
  title?: string;
  description?: string;
};

/**
 * Root-level SEO defaults. Applied via `getSeoMeta(rootSeo, routeSeo)` so
 * routes inherit the title template + Organization/WebSite JSON-LD and only
 * supply page-specific overrides.
 */
export function rootSeo(input: RootSeoInput): SeoConfig {
  const {locale, pathnameNoLocale, title, description} = input;
  const orgLd: WithContext<Organization> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    sameAs: ['https://www.instagram.com/timberwave'],
  };
  const siteLd: WithContext<WebSite> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: getLocaleConfig(locale).htmlLang,
  };
  return {
    title: title ?? SITE_NAME,
    titleTemplate: `%s | ${SITE_NAME}`,
    description: description ?? 'Lightboard — living · design · surfing',
    url: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
    jsonLd: [orgLd, siteLd] as unknown as JsonLd,
  };
}

export type ProductSeoInput = {
  title: string;
  description: string;
  imageUrl?: string | null;
  url: string;
  sku?: string | null;
  vendor?: string | null;
  price?: {amount: string; currencyCode: string} | null;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
};

export function productSeo(input: ProductSeoInput): SeoConfig {
  const offer: Offer | undefined = input.price
    ? {
        '@type': 'Offer',
        price: input.price.amount,
        priceCurrency: input.price.currencyCode,
        availability: `https://schema.org/${input.availability ?? 'InStock'}`,
        url: input.url,
      }
    : undefined;
  const productLd: WithContext<ProductLd> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    name: input.title,
    description: input.description,
    image: input.imageUrl ?? undefined,
    url: input.url,
    sku: input.sku ?? undefined,
    brand: input.vendor
      ? {'@type': 'Brand', name: input.vendor}
      : undefined,
    offers: offer,
  };
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    media: input.imageUrl
      ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
      : undefined,
    jsonLd: productLd as unknown as JsonLd,
  };
}

export type CollectionSeoInput = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string | null;
};

export function collectionSeo(input: CollectionSeoInput): SeoConfig {
  const pageLd: WithContext<CollectionPage> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'CollectionPage',
    name: input.title,
    description: input.description,
    url: input.url,
  };
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    media: input.imageUrl
      ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
      : undefined,
    jsonLd: pageLd as unknown as JsonLd,
  };
}

export function breadcrumbs(
  items: Array<{name: string; url: string}>,
): WithContext<BreadcrumbList> {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type ArticleSeoInput = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
};

export function articleSeo(input: ArticleSeoInput): SeoConfig {
  const articleLd: WithContext<Article> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.imageUrl ?? undefined,
    url: input.url,
    datePublished: input.publishedAt ?? undefined,
    author: input.authorName
      ? {'@type': 'Person', name: input.authorName}
      : undefined,
  };
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    media: input.imageUrl
      ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
      : undefined,
    jsonLd: articleLd as unknown as JsonLd,
  };
}

export type SimpleSeoInput = {
  title: string;
  description?: string;
  url: string;
};

/**
 * For simple pages (cart, search, account, pages, policies) — just a
 * title + canonical URL with no additional JSON-LD beyond root's defaults.
 */
export function simpleSeo(input: SimpleSeoInput): SeoConfig {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
  };
}

/**
 * Merge an additional JSON-LD payload into an existing SeoConfig. Hydrogen's
 * `getSeoMeta` preserves `jsonLd` across configs but each route's own config
 * holds a single `jsonLd` slot, so concat at the call site when a route emits
 * multiple structured-data blocks (e.g. Product + BreadcrumbList).
 */
export function withJsonLd(
  config: SeoConfig,
  extra: WithContext<Thing>,
): SeoConfig {
  const current = config.jsonLd;
  let next: WithContext<Thing>[];
  if (!current) {
    next = [extra];
  } else if (Array.isArray(current)) {
    next = [...current, extra];
  } else {
    next = [current, extra];
  }
  return {...config, jsonLd: next as unknown as JsonLd};
}

export {absoluteUrl, buildAlternates, SITE_NAME, SITE_URL} from '~/lib/seo-urls';
