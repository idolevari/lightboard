/**
 * Builders for /llms.txt and /llms-full.txt (https://llmstxt.org).
 *
 * Everything that Shopify holds (products, prices, colours, specs, FAQs,
 * policies, contact details) is read live from the Storefront API, so the
 * files never drift from the site. The remaining prose comes from
 * `~/lib/brand-facts`.
 */

import type {Storefront} from '@shopify/hydrogen';
import {
  ANSWER_FOR,
  BRAND_SUMMARY,
  FOUNDING_YEAR,
  GIFT_USE_CASES,
  HOW_TO_ORDER,
  MADE_IN,
  BOARDS_MADE_LABEL,
  isPersonalized,
} from '~/lib/brand-facts';
import {formatPrice} from '~/lib/meta';
import {SITE_NAME, SITE_URL, absoluteUrl} from '~/lib/seo-urls';
import {
  bilingualField,
  brandName,
  mf,
  optionValueLabel,
  plainText,
  readShippingFacts,
  shippingCostILS,
  type BusinessFields,
} from './seo.server';

type Field = {key: string; value?: string | null};

type LlmsProduct = {
  title: string;
  handle: string;
  description: string;
  vendor?: string | null;
  tags: Array<string>;
  availableForSale: boolean;
  priceRange: {minVariantPrice: {amount: string; currencyCode: string}};
  options: Array<{name: string; optionValues: Array<{name: string}>}>;
  descriptionHe?: {value?: string | null} | null;
  descriptionEn?: {value?: string | null} | null;
  specs?: {references?: {nodes?: Array<{fields?: Array<Field>}>} | null} | null;
};

type Policy = {title: string; handle: string; body: string} | null;

type LlmsData = {
  shop: BusinessFields & {
    name: string;
    shippingPolicy?: Policy;
    refundPolicy?: Policy;
    privacyPolicy?: Policy;
    termsOfService?: Policy;
  };
  products: {nodes: Array<LlmsProduct>};
  pages: {nodes: Array<{title: string; handle: string}>};
  faqs: {nodes: Array<{fields: Array<Field>}>};
};

export async function loadLlmsData(storefront: Storefront): Promise<LlmsData> {
  return (await storefront.query(LLMS_QUERY, {
    cache: storefront.CacheShort(),
  })) as LlmsData;
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function line(items: Array<string | null | undefined | false>): string {
  return items
    .filter((s) => s !== null && s !== undefined && s !== false)
    .join('\n');
}

function colors(product: LlmsProduct, locale: 'he' | 'en'): string | null {
  const option = product.options.find((o) => /colou?r|צבע/i.test(o.name));
  if (!option?.optionValues.length) return null;
  return option.optionValues
    .map((v) => {
      const he = optionValueLabel(v.name, 'he');
      return locale === 'en' && he !== v.name
        ? `${v.name} (${he})`
        : optionValueLabel(v.name, locale);
    })
    .join(', ');
}

function specs(product: LlmsProduct, locale: 'he' | 'en'): Array<string> {
  return (product.specs?.references?.nodes ?? [])
    .map((node) => {
      const fields = node.fields ?? [];
      const label = bilingualField(fields, 'label', locale);
      const value = bilingualField(fields, 'value', locale);
      return label && value ? `${label}: ${value}` : null;
    })
    .filter((s): s is string => Boolean(s));
}

function shippingLine(
  data: LlmsData,
  priceAmount: number,
  locale: 'he' | 'en',
) {
  const facts = readShippingFacts(data.shop);
  const cost = shippingCostILS(facts, priceAmount);
  const lead = `${facts.leadTime.min}–${facts.leadTime.max}`;
  if (locale === 'en') {
    const price =
      cost === 0
        ? 'free shipping within Israel'
        : cost !== null
          ? `shipping ₪${cost} within Israel`
          : 'ships within Israel';
    return `Made to order, delivered in ${lead} business days; ${price}.`;
  }
  const price =
    cost === 0
      ? 'משלוח חינם לכל הארץ'
      : cost !== null
        ? `משלוח ₪${cost} לכל הארץ`
        : 'משלוח לכל הארץ';
  return `נבנה בהזמנה אישית ומגיע תוך ${lead} ימי עסקים; ${price}.`;
}

function contactLines(data: LlmsData): Array<string> {
  const phone = mf(data.shop.phone);
  const email = mf(data.shop.email);
  const instagram = mf(data.shop.instagram);
  const handle = /instagram\.com\/([^/?#]+)/.exec(instagram)?.[1];
  return [
    email && `- Email: ${email}`,
    phone && `- Phone: ${phone}`,
    phone && `- WhatsApp: https://wa.me/${digits(phone)}`,
    instagram && `- Instagram: ${handle ? `@${handle} ` : ''}${instagram}`,
    mf(data.shop.businessAddress) &&
      `- Business address: ${mf(data.shop.businessAddress)}`,
  ].filter((s): s is string => Boolean(s));
}

function productFacts(data: LlmsData, product: LlmsProduct): Array<string> {
  const price = product.priceRange.minVariantPrice;
  const amount = Number(price.amount);
  const he = colors(product, 'he');
  const en = colors(product, 'en');
  const personalized = isPersonalized(product.tags);
  return [
    `- Product: ${product.title}${brandName(product.vendor) === product.title ? '' : ` by ${brandName(product.vendor)}`}`,
    `- Price: ${formatPrice(price)} (${price.currencyCode}, VAT included)${product.availableForSale ? '' : ' (currently sold out)'}`,
    en && `- Colours: ${en}`,
    he && `- צבעים: ${he}`,
    `- ${shippingLine(data, amount, 'en')}`,
    `- ${shippingLine(data, amount, 'he')}`,
    personalized &&
      '- Personalized with your own photos, so it cannot be cancelled once production starts (Israeli Consumer Protection Law). Defects are replaced or refunded.',
    `- Product page: ${absoluteUrl(`/products/${product.handle}`, 'he')} (Hebrew), ${absoluteUrl(`/products/${product.handle}`, 'en')} (English)`,
  ].filter((s): s is string => Boolean(s));
}

function policyLinks(data: LlmsData): Array<string> {
  const policies: Array<[Policy | undefined, string]> = [
    [data.shop.shippingPolicy, 'shipping cost, lead time, delivery areas'],
    [data.shop.refundPolicy, 'cancellations, returns, defects'],
    [data.shop.termsOfService, ''],
    [data.shop.privacyPolicy, ''],
  ];
  return policies
    .filter(([p]) => p?.handle)
    .map(
      ([p, note]) =>
        `- [${p!.title}](${SITE_URL}/policies/${p!.handle})${note ? `: ${note}` : ''}`,
    );
}

function header(): string {
  return line([
    `# ${SITE_NAME} (ליטבורד)`,
    '',
    `> ${BRAND_SUMMARY.en}`,
    '>',
    `> ${BRAND_SUMMARY.he}`,
  ]);
}

/** /llms.txt: short, link-first overview. */
export function renderLlmsTxt(data: LlmsData): string {
  const products = data.products.nodes;
  const contactPage = data.pages.nodes.find((p) => p.handle === 'contact');
  const otherPages = data.pages.nodes.filter((p) => p.handle !== 'contact');
  return line([
    header(),
    '',
    `Hebrew is the main language of the site (${SITE_URL}/); English is at ${SITE_URL}/en. Handmade in ${MADE_IN.en} since ${FOUNDING_YEAR}, ${BOARDS_MADE_LABEL} boards made.`,
    '',
    '## Key facts',
    ...products.flatMap((p) => productFacts(data, p)),
    `- How to order: ${HOW_TO_ORDER.en.join(' ')}`,
    ...contactLines(data),
    '',
    '## Good gift for',
    ...GIFT_USE_CASES.en.map((s) => `- ${s}`),
    ...GIFT_USE_CASES.he.map((s) => `- ${s}`),
    `- Searches this answers: ${ANSWER_FOR.join(', ')}`,
    '',
    '## Shop',
    ...products.flatMap((p) => [
      `- [${p.title} (Hebrew)](${absoluteUrl(`/products/${p.handle}`, 'he')}): product page, price, colours, photo upload`,
      `- [${p.title} (English)](${absoluteUrl(`/products/${p.handle}`, 'en')})`,
    ]),
    `- [All products](${SITE_URL}/collections/all)`,
    '',
    '## Policies and contact',
    ...policyLinks(data),
    contactPage && `- [${contactPage.title}](${SITE_URL}/pages/contact)`,
    `- [FAQ](${SITE_URL}/#faq)`,
    '',
    '## Optional',
    `- [Full version of this file, with FAQs, specs and policies](${SITE_URL}/llms-full.txt)`,
    ...otherPages.map((p) => `- [${p.title}](${SITE_URL}/pages/${p.handle})`),
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    '',
  ]);
}

/** Policy HTML → readable plain text that keeps paragraph breaks. */
function policyText(html: string): string {
  return html
    .replace(/<\s*(h[1-6])[^>]*>/gi, '\n\n### ')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|h[1-6]|ul|ol|div)>|<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((l) => plainText(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** /llms-full.txt: everything in one file. */
export function renderLlmsFullTxt(data: LlmsData): string {
  const sections: Array<string> = [renderLlmsTxt(data).trimEnd(), ''];

  for (const product of data.products.nodes) {
    const descEn = plainText(mf(product.descriptionEn));
    const descHe =
      plainText(mf(product.descriptionHe)) || plainText(product.description);
    const specsEn = specs(product, 'en');
    const specsHe = specs(product, 'he');
    sections.push(
      line([
        `## Product: ${product.title}`,
        '',
        descEn && `${descEn}`,
        descEn && '',
        descHe && `${descHe}`,
        descHe && '',
        specsEn.length > 0 && '### Specs',
        ...specsEn.map((s) => `- ${s}`),
        specsEn.length > 0 && '',
        specsHe.length > 0 && '### מפרט',
        ...specsHe.map((s) => `- ${s}`),
        specsHe.length > 0 && '',
      ]),
    );
  }

  sections.push(
    line([
      '## How personalization works',
      ...HOW_TO_ORDER.en.map((s, i) => `${i + 1}. ${s}`),
      '',
      '## איך מזמינים',
      ...HOW_TO_ORDER.he.map((s, i) => `${i + 1}. ${s}`),
      '',
    ]),
  );

  const faqs = data.faqs.nodes;
  if (faqs.length) {
    const block = (locale: 'he' | 'en') =>
      faqs
        .map((f) => ({
          q: bilingualField(f.fields, 'question', locale),
          a: bilingualField(f.fields, 'answer', locale),
        }))
        .filter((f) => f.q && f.a)
        .flatMap((f) => [`### ${f.q}`, f.a, '']);
    sections.push(
      line([
        '## FAQ (English)',
        '',
        ...block('en'),
        '## שאלות נפוצות',
        '',
        ...block('he'),
      ]),
    );
  }

  for (const policy of [data.shop.shippingPolicy, data.shop.refundPolicy]) {
    if (!policy?.body) continue;
    sections.push(
      line([
        `## ${policy.title}`,
        `Source: ${SITE_URL}/policies/${policy.handle}`,
        '',
        policyText(policy.body),
        '',
      ]),
    );
  }

  return sections.join('\n');
}

const LLMS_QUERY = `#graphql
  query LlmsTxt($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    shop {
      name
      phone: metafield(namespace: "business", key: "phone") { value }
      email: metafield(namespace: "business", key: "email") { value }
      instagram: metafield(namespace: "business", key: "instagram") { value }
      legalName: metafield(namespace: "business", key: "legal_name") { value }
      businessAddress: metafield(namespace: "business", key: "address") { value }
      freeShippingOver: metafield(namespace: "business", key: "free_shipping_over_ils") { value }
      shippingRate: metafield(namespace: "business", key: "shipping_rate_ils") { value }
      leadMin: metafield(namespace: "business", key: "lead_time_min_days") { value }
      leadMax: metafield(namespace: "business", key: "lead_time_max_days") { value }
      shippingPolicy { title handle body }
      refundPolicy { title handle body }
      privacyPolicy { title handle body }
      termsOfService { title handle body }
    }
    products(first: 20, sortKey: BEST_SELLING) {
      nodes {
        title
        handle
        description
        vendor
        tags
        availableForSale
        priceRange { minVariantPrice { amount currencyCode } }
        options { name optionValues { name } }
        descriptionHe: metafield(namespace: "marketing", key: "description_he") { value }
        descriptionEn: metafield(namespace: "marketing", key: "description_en") { value }
        specs: metafield(namespace: "marketing", key: "specs") {
          references(first: 20) {
            nodes {
              ... on Metaobject { fields { key value } }
            }
          }
        }
      }
    }
    pages(first: 20) { nodes { title handle } }
    faqs: metaobjects(type: "faq", first: 20, sortKey: "position") {
      nodes { fields { key value } }
    }
  }
` as const;
