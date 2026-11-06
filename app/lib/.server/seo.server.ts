/**
 * Centralized SEO builders. Each helper returns `{seo, jsonLd}`:
 *
 *  - `seo` is a Hydrogen `SeoConfig` (no `jsonLd` field — see below) consumed
 *    by `getSeoMeta(...)` in a route's `meta` export, which produces the
 *    standard `<title>` / `<meta>` / `<link rel="canonical">` descriptors.
 *  - `jsonLd` is a flat array of schema.org payloads rendered as
 *    `<script type="application/ld+json">` tags by the `<JsonLd>` component.
 *
 * The site-wide entity graph (OnlineStore, WebSite, MerchantReturnPolicy,
 * plus FAQPage on `/` and ProductGroup + BreadcrumbList on product pages) is
 * built by `siteJsonLd` from live Shopify data and rendered once by the root
 * route as a single `@graph`. Route builders only add page types the graph
 * doesn't cover (CollectionPage, Article).
 *
 * JSON-LD is **deliberately not** routed through `getSeoMeta` / React
 * Router's `<Meta />` because RR's `script:ld+json` meta descriptor
 * disagrees with itself across SSR vs CSR on the `type` attribute,
 * triggering a hydration mismatch. See `app/components/JsonLd.tsx`.
 *
 * Unconfirmed or non-Shopify facts come from `~/lib/brand-facts` only.
 */

import type {SeoConfig, Storefront} from '@shopify/hydrogen';
import type {Article, CollectionPage, WithContext} from 'schema-dts';
import {
  ALTERNATE_NAMES,
  BRAND_SUMMARY,
  DELIVERY_SPLIT,
  FOUNDING_YEAR,
  KNOWS_ABOUT,
  LEAD_TIME_BUSINESS_DAYS,
  isPersonalized,
  RETURN_WINDOW_DAYS,
  SHIPPING_FACTS,
} from '~/lib/brand-facts';
import {
  getDictionary,
  getLocaleConfig,
  localizedPath,
  type Locale,
} from '~/lib/i18n';
import {SITE_NAME, SITE_URL, absoluteUrl} from '~/lib/seo-urls';

const SCHEMA_CONTEXT = 'https://schema.org' as const;

// schema-dts unions are too wide for TS to distribute through a loader
// round-trip without blowing the recursive-types budget. Payloads are typed
// narrowly at the builder site and widened here for the route.
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
 *
 * The returned `jsonLd` is the static fallback graph (Organization + WebSite,
 * no contact data). It is used while the launch gate is on and when the
 * Storefront API is unreachable. The full graph comes from `siteJsonLd`.
 */
export function rootSeo(input: RootSeoInput): SeoResult {
  const {locale, pathnameNoLocale, title, description} = input;
  return {
    seo: {
      title: title ?? SITE_NAME,
      titleTemplate: `%s | ${SITE_NAME}`,
      description: description ?? 'Lightboard — living · design · surfing',
      url: `${SITE_URL}${localizedPath(pathnameNoLocale, locale)}`,
    },
    jsonLd: [
      {
        '@context': SCHEMA_CONTEXT,
        '@graph': [organizationNode(null, locale), websiteNode(locale)],
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Site-wide @graph                                                           */
/* -------------------------------------------------------------------------- */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const RETURN_POLICY_ID = `${SITE_URL}/#return-policy`;

type MetafieldValue = {value?: string | null} | null | undefined;

export type BusinessFields = {
  phone?: MetafieldValue;
  email?: MetafieldValue;
  instagram?: MetafieldValue;
  legalName?: MetafieldValue;
  businessAddress?: MetafieldValue;
  freeShippingOver?: MetafieldValue;
  shippingRate?: MetafieldValue;
  leadMin?: MetafieldValue;
  leadMax?: MetafieldValue;
};

type PolicyRef = {url?: string | null; handle?: string | null} | null;

type SiteGraphShop = BusinessFields & {
  refundPolicy?: PolicyRef;
  shippingPolicy?: PolicyRef;
};

type SiteGraphVariant = {
  id: string;
  title: string;
  sku?: string | null;
  availableForSale: boolean;
  price: {amount: string; currencyCode: string};
  image?: {url: string} | null;
  selectedOptions: Array<{name: string; value: string}>;
};

export type SiteGraphProduct = {
  title: string;
  handle: string;
  description: string;
  vendor?: string | null;
  tags: Array<string>;
  productType?: string | null;
  seo?: {title?: string | null; description?: string | null} | null;
  descriptionHe?: MetafieldValue;
  descriptionEn?: MetafieldValue;
  images: {nodes: Array<{url: string; altText?: string | null}>};
  variants: {nodes: Array<SiteGraphVariant>};
};

type SiteGraphFaq = {fields: Array<{key: string; value?: string | null}>};

export function mf(field: MetafieldValue): string {
  return (field?.value ?? '').trim();
}

function mfNumber(field: MetafieldValue): number | null {
  const raw = mf(field);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Collapse HTML (or run-together paragraphs) into one plain-text line. */
export function plainText(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<\/(p|li|h[1-6]|div)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shipping facts: shop metafields win, `~/lib/brand-facts` is the fallback.
 */
export function readShippingFacts(shop: BusinessFields | null | undefined) {
  const freeOver = mfNumber(shop?.freeShippingOver);
  const rate = mfNumber(shop?.shippingRate);
  const lead = {
    min: mfNumber(shop?.leadMin) ?? LEAD_TIME_BUSINESS_DAYS.min,
    max: mfNumber(shop?.leadMax) ?? LEAD_TIME_BUSINESS_DAYS.max,
  };
  // Keep the courier share fixed and give the rest to production.
  const transit = DELIVERY_SPLIT.transit;
  const handling = {
    min: Math.max(0, lead.min - transit.min),
    max: Math.max(0, lead.max - transit.max),
  };
  return {
    freeShippingOverILS: freeOver ?? SHIPPING_FACTS.freeShippingOverILS,
    standardRateILS: rate ?? SHIPPING_FACTS.standardRateILS,
    leadTime: lead,
    handling,
    transit,
  };
}

export type ShippingFacts = ReturnType<typeof readShippingFacts>;

/** Shipping cost in ILS for an order of `priceILS`, or null when unknown. */
export function shippingCostILS(
  facts: ShippingFacts,
  priceILS: number,
): number | null {
  const {freeShippingOverILS: freeOver, standardRateILS: rate} = facts;
  if (freeOver !== null && priceILS >= freeOver) return 0;
  return rate;
}

function shippingDetailsNode(facts: ShippingFacts, priceILS: number) {
  const cost = shippingCostILS(facts, priceILS);
  // Google treats shippingRate as required inside OfferShippingDetails, so
  // leave the block out rather than guess a price.
  if (cost === null) return undefined;
  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: SHIPPING_FACTS.shipsTo.map((country) => ({
      '@type': 'DefinedRegion',
      addressCountry: country,
    })),
    shippingRate: {'@type': 'MonetaryAmount', value: cost, currency: 'ILS'},
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: facts.handling.min,
        maxValue: facts.handling.max,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: facts.transit.min,
        maxValue: facts.transit.max,
        unitCode: 'DAY',
      },
      businessDays: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'https://schema.org/Sunday',
          'https://schema.org/Monday',
          'https://schema.org/Tuesday',
          'https://schema.org/Wednesday',
          'https://schema.org/Thursday',
        ],
      },
    },
  };
}

function policyUrl(policy: PolicyRef, fallbackHandle: string): string {
  return `${SITE_URL}/policies/${policy?.handle || fallbackHandle}`;
}

function returnPolicyNode(shop: SiteGraphShop | null) {
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': RETURN_POLICY_ID,
    applicableCountry: 'IL',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RETURN_WINDOW_DAYS,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
    merchantReturnLink: policyUrl(shop?.refundPolicy ?? null, 'refund-policy'),
  };
}

/** Personalized (made-from-your-photos) items: no cancellation once made,
 *  except for defects, per the Refund Policy. */
function personalizedReturnPolicy(shop: SiteGraphShop | null) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'IL',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    merchantReturnLink: policyUrl(shop?.refundPolicy ?? null, 'refund-policy'),
  };
}

function organizationNode(shop: SiteGraphShop | null, locale: Locale) {
  const instagram = mf(shop?.instagram);
  const phone = mf(shop?.phone);
  const email = mf(shop?.email);
  // business.address is free text such as "הוד השרון, ישראל"; the first
  // part is the city. This is the legal address, not the "made in" copy.
  const locality = mf(shop?.businessAddress).split(',')[0]?.trim();
  return {
    '@type': 'OnlineStore',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: ALTERNATE_NAMES,
    legalName: mf(shop?.legalName) || SITE_NAME,
    url: `${SITE_URL}/`,
    logo: {'@type': 'ImageObject', url: `${SITE_URL}/favicon.png`},
    description: locale === 'en' ? BRAND_SUMMARY.en : BRAND_SUMMARY.he,
    foundingDate: String(FOUNDING_YEAR),
    email: email || undefined,
    telephone: phone || undefined,
    address: locality
      ? {
          '@type': 'PostalAddress',
          addressLocality: locality,
          addressCountry: 'IL',
        }
      : undefined,
    areaServed: {'@type': 'Country', name: 'Israel'},
    contactPoint:
      phone || email
        ? [
            {
              '@type': 'ContactPoint',
              contactType: 'customer service',
              telephone: phone || undefined,
              email: email || undefined,
              availableLanguage: ['he', 'en'],
              areaServed: 'IL',
            },
          ]
        : undefined,
    // Only the brand's own profile from Shopify (business.instagram).
    sameAs: /^https?:\/\//.test(instagram) ? [instagram] : undefined,
    hasMerchantReturnPolicy: shop ? {'@id': RETURN_POLICY_ID} : undefined,
    knowsAbout: KNOWS_ABOUT,
  };
}

function websiteNode(locale: Locale) {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    alternateName: ALTERNATE_NAMES[0],
    url: `${SITE_URL}/`,
    inLanguage: getLocaleConfig(locale).htmlLang,
    publisher: {'@id': ORG_ID},
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl('/search', locale)}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Read a bilingual metaobject field pair, falling back to Hebrew. */
export function bilingualField(
  fields: Array<{key: string; value?: string | null}>,
  base: string,
  locale: Locale,
): string {
  const get = (key: string) =>
    plainText(fields.find((f) => f.key === key)?.value);
  return locale === 'en'
    ? get(`${base}_en`) || get(`${base}_he`)
    : get(`${base}_he`);
}

function faqNode(faqs: Array<SiteGraphFaq>, locale: Locale) {
  const items = faqs
    .map((faq) => ({
      q: bilingualField(faq.fields, 'question', locale),
      a: bilingualField(faq.fields, 'answer', locale),
    }))
    .filter((x) => x.q && x.a);
  if (items.length === 0) return null;
  const url = absoluteUrl('/', locale);
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    inLanguage: getLocaleConfig(locale).htmlLang,
    mainEntity: items.map(({q, a}) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {'@type': 'Answer', text: a},
    })),
  };
}

/** Localized display name for a Shopify option value (e.g. Light Blue → תכלת). */
export function optionValueLabel(value: string, locale: Locale): string {
  const map = getDictionary(locale).product?.optionValues as
    | Record<string, string>
    | undefined;
  return map?.[value] ?? value;
}

/** The brand is Lightboard whatever the Shopify Vendor field says
 *  (it currently says "My Store"). */
export function brandName(vendor: string | null | undefined): string {
  const v = (vendor ?? '').trim();
  if (!v || /^my store$/i.test(v)) return SITE_NAME;
  return v;
}

export function productDescription(
  product: Pick<
    SiteGraphProduct,
    'seo' | 'descriptionHe' | 'descriptionEn' | 'description'
  >,
  locale: Locale,
): string {
  if (locale === 'en') {
    return (
      plainText(mf(product.descriptionEn)) ||
      plainText(product.seo?.description) ||
      plainText(mf(product.descriptionHe)) ||
      plainText(product.description)
    );
  }
  return (
    plainText(product.seo?.description) ||
    plainText(mf(product.descriptionHe)) ||
    plainText(product.description)
  );
}

function productNodes(
  product: SiteGraphProduct,
  shop: SiteGraphShop | null,
  locale: Locale,
) {
  const productUrl = absoluteUrl(`/products/${product.handle}`, locale);
  const groupId = `${productUrl}#product`;
  const brand = {'@type': 'Brand', name: brandName(product.vendor)};
  const personalized = isPersonalized(product.tags);
  const facts = readShippingFacts(shop);
  const images = product.images.nodes.map((i) => i.url);
  const variants = product.variants.nodes;
  const optionNames = Array.from(
    new Set(variants.flatMap((v) => v.selectedOptions.map((o) => o.name))),
  ).filter((name) => name !== 'Title');

  const variantNodes = variants.map((v) => {
    const color = v.selectedOptions.find((o) => /colou?r|צבע/i.test(o.name));
    const label = color ? optionValueLabel(color.value, locale) : v.title;
    const query = v.selectedOptions
      .filter((o) => o.name !== 'Title')
      .map(
        (o) => `${encodeURIComponent(o.name)}=${encodeURIComponent(o.value)}`,
      )
      .join('&');
    return {
      '@type': 'Product',
      '@id': `${productUrl}#variant-${v.id.split('/').pop()}`,
      name: variants.length > 1 ? `${product.title} — ${label}` : product.title,
      sku: v.sku || undefined,
      color: color ? label : undefined,
      image: v.image?.url ?? images[0],
      brand,
      isVariantOf: {'@id': groupId},
      offers: {
        '@type': 'Offer',
        url: query ? `${productUrl}?${query}` : productUrl,
        price: v.price.amount,
        priceCurrency: v.price.currencyCode,
        availability: v.availableForSale
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {'@id': ORG_ID},
        shippingDetails: shippingDetailsNode(facts, Number(v.price.amount)),
        hasMerchantReturnPolicy: personalized
          ? personalizedReturnPolicy(shop)
          : {'@id': RETURN_POLICY_ID},
      },
    };
  });

  const group = {
    '@type': 'ProductGroup',
    '@id': groupId,
    name: product.title,
    description: productDescription(product, locale) || undefined,
    url: productUrl,
    brand,
    image: images.length ? images : undefined,
    productGroupID: product.handle,
    variesBy: optionNames.map((name) =>
      /colou?r|צבע/i.test(name) ? 'https://schema.org/color' : name,
    ),
    category: product.productType || undefined,
    inLanguage: getLocaleConfig(locale).htmlLang,
    hasVariant: variantNodes,
  };

  const crumbs = {
    '@type': 'BreadcrumbList',
    '@id': `${productUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'en' ? 'Home' : 'בית',
        item: absoluteUrl('/', locale),
      },
      {'@type': 'ListItem', position: 2, name: product.title, item: productUrl},
    ],
  };
  return [group, crumbs];
}

const SITE_GRAPH_QUERY = `#graphql
  query SiteGraph(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
    $withProduct: Boolean!
    $withFaqs: Boolean!
  ) @inContext(country: $country, language: $language) {
    shop {
      phone: metafield(namespace: "business", key: "phone") { value }
      email: metafield(namespace: "business", key: "email") { value }
      instagram: metafield(namespace: "business", key: "instagram") { value }
      legalName: metafield(namespace: "business", key: "legal_name") { value }
      businessAddress: metafield(namespace: "business", key: "address") { value }
      freeShippingOver: metafield(namespace: "business", key: "free_shipping_over_ils") { value }
      shippingRate: metafield(namespace: "business", key: "shipping_rate_ils") { value }
      leadMin: metafield(namespace: "business", key: "lead_time_min_days") { value }
      leadMax: metafield(namespace: "business", key: "lead_time_max_days") { value }
      refundPolicy { url handle }
      shippingPolicy { url handle }
    }
    product(handle: $handle) @include(if: $withProduct) {
      title
      handle
      description
      vendor
      tags
      productType
      seo { title description }
      descriptionHe: metafield(namespace: "marketing", key: "description_he") { value }
      descriptionEn: metafield(namespace: "marketing", key: "description_en") { value }
      images(first: 10) { nodes { url altText } }
      variants(first: 50) {
        nodes {
          id
          title
          sku
          availableForSale
          price { amount currencyCode }
          image { url }
          selectedOptions { name value }
        }
      }
    }
    faqs: metaobjects(type: "faq", first: 20, sortKey: "position") @include(if: $withFaqs) {
      nodes { fields { key value } }
    }
  }
` as const;

/**
 * The site-wide JSON-LD `@graph` for the current page, built from live
 * Shopify data. Always includes OnlineStore (Organization), WebSite and the
 * shop MerchantReturnPolicy. Adds FAQPage on the homepage and ProductGroup +
 * BreadcrumbList on product pages. Never throws: on a Storefront API error
 * it returns the static fallback graph.
 */
export async function siteJsonLd(
  storefront: Storefront,
  {locale, pathnameNoLocale}: {locale: Locale; pathnameNoLocale: string},
): Promise<JsonLdPayload> {
  const path = pathnameNoLocale.replace(/\/+$/, '') || '/';
  const productHandle = /^\/products\/([^/]+)$/.exec(path)?.[1] ?? null;
  const isHome = path === '/';
  try {
    let handle = '';
    if (productHandle) {
      try {
        handle = decodeURIComponent(productHandle);
      } catch {
        handle = productHandle;
      }
    }
    const data = (await storefront.query(SITE_GRAPH_QUERY, {
      cache: productHandle ? storefront.CacheShort() : storefront.CacheLong(),
      variables: {
        handle,
        withProduct: Boolean(productHandle),
        withFaqs: isHome,
      },
    })) as {
      shop?: SiteGraphShop | null;
      product?: SiteGraphProduct | null;
      faqs?: {nodes: Array<SiteGraphFaq>} | null;
    };
    const shop = data?.shop ?? null;
    const graph: Array<object> = [
      organizationNode(shop, locale),
      websiteNode(locale),
      returnPolicyNode(shop),
    ];
    if (isHome && data?.faqs?.nodes?.length) {
      const faq = faqNode(data.faqs.nodes, locale);
      if (faq) graph.push(faq);
    }
    if (data?.product) graph.push(...productNodes(data.product, shop, locale));
    return [{'@context': SCHEMA_CONTEXT, '@graph': graph}];
  } catch (error) {
    console.error('[seo] siteJsonLd failed', error);
    return rootSeo({locale, pathnameNoLocale}).jsonLd;
  }
}

/* -------------------------------------------------------------------------- */
/*  Per-route builders                                                         */
/* -------------------------------------------------------------------------- */

export type ProductSeoInput = {
  title: string;
  description: string;
  imageUrl?: string | null;
  url: string;
  sku?: string | null;
  vendor?: string | null;
  price?: {amount: string; currencyCode: string} | null;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  /** Kept for API compatibility. The breadcrumb is now part of the site graph. */
  breadcrumb?: ReadonlyArray<{name: string; url: string}>;
};

/**
 * Product page meta. The Product JSON-LD (ProductGroup with every variant,
 * Offer, shipping and returns, BreadcrumbList) is emitted by `siteJsonLd`
 * in the root graph, so this returns no JSON-LD of its own to avoid
 * duplicate Product entities.
 */
export function productSeo(input: ProductSeoInput): SeoResult {
  return {
    seo: {
      title: input.title,
      description: plainText(input.description),
      url: input.url,
      media: input.imageUrl
        ? {type: 'image', url: input.imageUrl, height: 1200, width: 1200}
        : undefined,
    },
    jsonLd: [],
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
    isPartOf: {'@id': WEBSITE_ID},
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
    publisher: {'@id': ORG_ID},
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
 * title + canonical URL with no additional JSON-LD beyond root's graph.
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

export {
  absoluteUrl,
  buildAlternates,
  SITE_NAME,
  SITE_URL,
} from '~/lib/seo-urls';
