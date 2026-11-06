import {describe, expect, it, vi} from 'vitest';
import type {Storefront} from '@shopify/hydrogen';
import {
  brandName,
  plainText,
  readShippingFacts,
  shippingCostILS,
  siteJsonLd,
  type SiteGraphProduct,
} from '~/lib/.server/seo.server';

type Node = Record<string, unknown> & {'@type': string};

const SHOP = {
  phone: {value: '+972-55-720-9448'},
  email: {value: 'lightboardshop@gmail.com'},
  instagram: {value: 'https://instagram.com/lightboard'},
  legalName: {value: 'Lightboard'},
  businessAddress: {value: 'הוד השרון, ישראל'},
  refundPolicy: {url: null, handle: 'refund-policy'},
};

const PRODUCT: SiteGraphProduct = {
  title: 'Lightboard',
  handle: 'lightboard',
  description: '<p>Solid pine &amp; warm LEDs</p>',
  vendor: 'My Store',
  tags: ['requires-photos'],
  productType: 'Wall decor',
  images: {nodes: [{url: 'https://cdn.shopify.com/a.jpg'}]},
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/111',
        title: 'Light Blue',
        availableForSale: true,
        price: {amount: '279.0', currencyCode: 'ILS'},
        selectedOptions: [{name: 'Color', value: 'Light Blue'}],
      },
      {
        id: 'gid://shopify/ProductVariant/222',
        title: 'Pink',
        availableForSale: false,
        price: {amount: '279.0', currencyCode: 'ILS'},
        image: {url: 'https://cdn.shopify.com/pink.jpg'},
        selectedOptions: [{name: 'Color', value: 'Pink'}],
      },
    ],
  },
};

const FAQS = [
  {
    fields: [
      {key: 'question_he', value: 'כמה זמן לוקח?'},
      {key: 'answer_he', value: '<p>5–7 ימי עסקים</p>'},
      {key: 'question_en', value: 'How long?'},
      {key: 'answer_en', value: ''},
    ],
  },
  // Incomplete items are dropped.
  {fields: [{key: 'question_he', value: 'בלי תשובה'}]},
];

function fakeStorefront(data: unknown, fail = false) {
  const query = vi.fn(async () => {
    if (fail) throw new Error('storefront down');
    return data;
  });
  const storefront = {
    query,
    CacheShort: () => ({mode: 'short'}),
    CacheLong: () => ({mode: 'long'}),
  } as unknown as Storefront;
  return {storefront, query};
}

async function graph(
  data: unknown,
  locale: 'he' | 'en',
  pathnameNoLocale: string,
): Promise<Array<Node>> {
  const {storefront} = fakeStorefront(data);
  const [root] = (await siteJsonLd(storefront, {locale, pathnameNoLocale})) as [
    {'@context': string; '@graph': Array<Node>},
  ];
  expect(root['@context']).toBe('https://schema.org');
  return root['@graph'];
}

const byType = (nodes: Array<Node>, type: string) =>
  nodes.find((n) => n['@type'] === type) as Node;

describe('siteJsonLd: product page', () => {
  it('emits OnlineStore, WebSite, return policy, ProductGroup and breadcrumbs', async () => {
    const nodes = await graph(
      {shop: SHOP, product: PRODUCT},
      'he',
      '/products/lightboard',
    );
    expect(nodes.map((n) => n['@type'])).toEqual([
      'OnlineStore',
      'WebSite',
      'MerchantReturnPolicy',
      'ProductGroup',
      'BreadcrumbList',
    ]);
  });

  it('builds one Product per variant with a localized colour and price Offer', async () => {
    const nodes = await graph(
      {shop: SHOP, product: PRODUCT},
      'he',
      '/products/lightboard',
    );
    const group = byType(nodes, 'ProductGroup');
    expect(group.productGroupID).toBe('lightboard');
    expect(group.variesBy).toEqual(['https://schema.org/color']);
    // Brand is Lightboard even though the Shopify vendor says "My Store".
    expect(group.brand).toEqual({'@type': 'Brand', name: 'Lightboard'});
    expect(group.description).toBe('Solid pine & warm LEDs');

    const [blue, pink] = group.hasVariant as Array<Node & {offers: Node}>;
    expect(blue.name).toBe('Lightboard — תכלת');
    expect(blue.color).toBe('תכלת');
    expect(blue['@id']).toBe(
      'https://lightboard.co.il/products/lightboard#variant-111',
    );
    expect(blue.image).toBe('https://cdn.shopify.com/a.jpg');
    expect(pink.image).toBe('https://cdn.shopify.com/pink.jpg');

    expect(blue.offers.price).toBe('279.0');
    expect(blue.offers.priceCurrency).toBe('ILS');
    expect(blue.offers.url).toBe(
      'https://lightboard.co.il/products/lightboard?Color=Light%20Blue',
    );
    expect(blue.offers.availability).toBe('https://schema.org/InStock');
    expect(pink.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('declares free shipping to Israel with a 5–7 day split into handling + transit', async () => {
    const nodes = await graph(
      {shop: SHOP, product: PRODUCT},
      'he',
      '/products/lightboard',
    );
    type Range = {minValue: number; maxValue: number};
    const [variant] = byType(nodes, 'ProductGroup').hasVariant as Array<{
      offers: {
        shippingDetails: {
          shippingRate: unknown;
          shippingDestination: unknown;
          deliveryTime: {handlingTime: Range; transitTime: Range};
        };
      };
    }>;
    const shipping = variant.offers.shippingDetails;
    expect(shipping.shippingRate).toEqual({
      '@type': 'MonetaryAmount',
      value: 0,
      currency: 'ILS',
    });
    expect(shipping.shippingDestination).toEqual([
      {'@type': 'DefinedRegion', addressCountry: 'IL'},
    ]);
    const {handlingTime, transitTime} = shipping.deliveryTime;
    expect(handlingTime.minValue + transitTime.minValue).toBe(5);
    expect(handlingTime.maxValue + transitTime.maxValue).toBe(7);
  });

  it('marks personalized products as non-returnable', async () => {
    const nodes = await graph(
      {shop: SHOP, product: PRODUCT},
      'he',
      '/products/lightboard',
    );
    const [variant] = byType(nodes, 'ProductGroup').hasVariant as Array<{
      offers: {hasMerchantReturnPolicy: Node};
    }>;
    expect(variant.offers.hasMerchantReturnPolicy).toMatchObject({
      '@type': 'MerchantReturnPolicy',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
      merchantReturnLink: 'https://lightboard.co.il/policies/refund-policy',
    });
  });

  it('links non-personalized products to the shop 14-day return policy', async () => {
    const stock = {...PRODUCT, tags: []};
    const nodes = await graph(
      {shop: SHOP, product: stock},
      'he',
      '/products/lightboard',
    );
    const policy = byType(nodes, 'MerchantReturnPolicy');
    expect(policy.merchantReturnDays).toBe(14);
    const [variant] = byType(nodes, 'ProductGroup').hasVariant as Array<{
      offers: {hasMerchantReturnPolicy: unknown};
    }>;
    expect(variant.offers.hasMerchantReturnPolicy).toEqual({
      '@id': policy['@id'],
    });
  });

  it('uses /en URLs and English breadcrumbs on the English site', async () => {
    const nodes = await graph(
      {shop: SHOP, product: PRODUCT},
      'en',
      '/products/lightboard',
    );
    const crumbs = byType(nodes, 'BreadcrumbList')
      .itemListElement as Array<Node>;
    expect(crumbs[0]).toMatchObject({
      name: 'Home',
      item: 'https://lightboard.co.il/en',
    });
    expect(crumbs[1].item).toBe(
      'https://lightboard.co.il/en/products/lightboard',
    );
  });

  it('decodes the product handle and asks for short-cached product data', async () => {
    const {storefront, query} = fakeStorefront({shop: SHOP, product: null});
    await siteJsonLd(storefront, {
      locale: 'he',
      pathnameNoLocale: `/products/${encodeURIComponent('גלשן')}/`,
    });
    const [, options] = query.mock.calls[0] as unknown as [
      string,
      {cache: unknown; variables: Record<string, unknown>},
    ];
    expect(options.variables).toEqual({
      handle: 'גלשן',
      withProduct: true,
      withFaqs: false,
    });
    expect(options.cache).toEqual({mode: 'short'});
  });
});

describe('siteJsonLd: homepage and organization', () => {
  it('adds a FAQPage, dropping items without both a question and an answer', async () => {
    const nodes = await graph({shop: SHOP, faqs: {nodes: FAQS}}, 'he', '/');
    const faq = byType(nodes, 'FAQPage');
    expect(faq.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'כמה זמן לוקח?',
        acceptedAnswer: {'@type': 'Answer', text: '5–7 ימי עסקים'},
      },
    ]);
  });

  it('falls back to the Hebrew answer when the English one is empty', async () => {
    const nodes = await graph({shop: SHOP, faqs: {nodes: FAQS}}, 'en', '/');
    const [q] = byType(nodes, 'FAQPage').mainEntity as Array<{
      name: string;
      acceptedAnswer: {text: string};
    }>;
    expect(q.name).toBe('How long?');
    expect(q.acceptedAnswer.text).toBe('5–7 ימי עסקים');
  });

  it('fills contact details and the legal city from shop metafields', async () => {
    const nodes = await graph({shop: SHOP}, 'he', '/');
    const org = byType(nodes, 'OnlineStore');
    expect(org.telephone).toBe('+972-55-720-9448');
    expect(org.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'הוד השרון',
      addressCountry: 'IL',
    });
    expect(org.sameAs).toEqual(['https://instagram.com/lightboard']);
  });

  it('returns the static fallback graph when the Storefront API fails', async () => {
    const {storefront} = fakeStorefront(null, true);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const [root] = (await siteJsonLd(storefront, {
      locale: 'he',
      pathnameNoLocale: '/',
    })) as [{'@graph': Array<Node>}];
    expect(root['@graph'].map((n) => n['@type'])).toEqual([
      'OnlineStore',
      'WebSite',
    ]);
    expect(spy).toHaveBeenCalled();
  });
});

describe('SEO helpers', () => {
  it('plainText collapses HTML into one line and decodes entities', () => {
    expect(plainText('<p>One</p><p>Two&nbsp;&amp; three</p><br/>')).toBe(
      'One Two & three',
    );
    expect(plainText(null)).toBe('');
  });

  it('brandName ignores the default "My Store" vendor', () => {
    expect(brandName('My Store')).toBe('Lightboard');
    expect(brandName('')).toBe('Lightboard');
    expect(brandName('Other Co')).toBe('Other Co');
  });

  it('shop metafields override shipping facts', () => {
    const facts = readShippingFacts({
      freeShippingOver: {value: '299'},
      shippingRate: {value: '30'},
      leadMin: {value: '7'},
      leadMax: {value: '10'},
    });
    expect(facts.leadTime).toEqual({min: 7, max: 10});
    expect(facts.handling).toEqual({min: 5, max: 8});
    expect(shippingCostILS(facts, 279)).toBe(30);
    expect(shippingCostILS(facts, 299)).toBe(0);
  });
});
