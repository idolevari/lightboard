/**
 * Centralized SEO builders. Each helper returns `{seo, jsonLd}`:
 *
 *  - `seo` is a Hydrogen `SeoConfig` (no `jsonLd` field — see below) consumed
 *    by `getSeoMeta(...)` in a route's `meta` export, which produces the
 *    standard `<title>` / `<meta>` / `<link rel="canonical">` descriptors.
 *  - `jsonLd` is a flat array of schema.org payloads (`WithContext<Thing>`)
 *    rendered as `<script type="application/ld+json">` tags by the
 *    `<JsonLd>` component in each route's JSX.
 *
 * JSON-LD is **deliberately not** routed through `getSeoMeta` / React
 * Router's `<Meta />` because RR's `script:ld+json` meta descriptor
 * disagrees with itself across SSR vs CSR on the `type` attribute,
 * triggering a hydration mismatch. See `app/components/JsonLd.tsx` for the
 * fix.
 *
 * The hreflang `<link rel="alternate">` set is emitted via `alternateLinks`
 * from `~/lib/seo-urls` and is added by `routeMeta` in every route's `meta`
 * export.
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
  WebSite,
  WithContext,
} from 'schema-dts';
import {getLocaleConfig, localizedPath, type Locale} from '~/lib/i18n';
import {SITE_NAME, SITE_URL} from '~/lib/seo-urls';

const SCHEMA_CONTEXT = 'https://schema.org' as const;

// schema-dts unions (e.g. `Organization = OrganizationLeaf | Airline | ...`)
// are too wide for TS to distribute through a loader round-trip without
// blowing the recursive-types budget. We type each payload narrowly at the
// builder site and widen via this alias for the `Array<object>` returned to
// the route. Consumers (`<JsonLd>`) only need the structural shape.
type JsonLdPayload = ReadonlyArray<object>;

export type RootSeoInput = {
  locale: Locale;
  pathnameNoLocale: string;
  title?: string;
  description?: string;
};

export type SeoResult = {seo: SeoConfig; jsonLd: JsonLdPayload};

/**
 * Root-level SEO defaults. Applied via `getSeoMeta(rootSeo, routeSeo)` so
 * routes inherit the title template and only supply page-specific overrides.
 * Returns the Organization + WebSite JSON-LD that should appear on every
 * page; child routes add product/collection-specific schemas on top.
 */
export function rootSeo(input: RootSeoInput): SeoResult {
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
    seo: {
      title: title ?? SITE_NAME,
      titleTemplate: `%s | ${SITE_NAME}`,
      description: description ?? 'Lightboard — living · design · surfing',
      url: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
    },
    jsonLd: [orgLd, siteLd],
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
  /** Optional breadcrumb trail; emitted as a separate BreadcrumbList payload. */
  breadcrumb?: ReadonlyArray<{name: string; url: string}>;
};

export function productSeo(input: ProductSeoInput): SeoResult {
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
  const payload: Array<object> = [productLd];
  if (input.breadcrumb && input.breadcrumb.length > 0) {
    payload.push(breadcrumbs(input.breadcrumb));
  }
  return {
    seo: {
      title: input.title,
      description: input.description,
      url: input.url,
      media: input.imageUrl
        ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
        : undefined,
    },
    jsonLd: payload,
  };
}

export type CollectionSeoInput = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string | null;
};

export function collectionSeo(input: CollectionSeoInput): SeoResult {
  const pageLd: WithContext<CollectionPage> = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'CollectionPage',
    name: input.title,
    description: input.description,
    url: input.url,
  };
  return {
    seo: {
      title: input.title,
      description: input.description,
      url: input.url,
      media: input.imageUrl
        ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
        : undefined,
    },
    jsonLd: [pageLd],
  };
}

export function breadcrumbs(
  items: ReadonlyArray<{name: string; url: string}>,
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

export function articleSeo(input: ArticleSeoInput): SeoResult {
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
    seo: {
      title: input.title,
      description: input.description,
      url: input.url,
      media: input.imageUrl
        ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
        : undefined,
    },
    jsonLd: [articleLd],
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
export function simpleSeo(input: SimpleSeoInput): SeoResult {
  return {
    seo: {
      title: input.title,
      description: input.description,
      url: input.url,
    },
    jsonLd: [],
  };
}

export {absoluteUrl, buildAlternates, SITE_NAME, SITE_URL} from '~/lib/seo-urls';
