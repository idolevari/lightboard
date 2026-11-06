import {describe, expect, it} from 'vitest';
import {
  canonicalUrl,
  formatPrice,
  homeSeoCopy,
  pageTitle,
  productSeoCopy,
  siteName,
  siteOrigin,
} from '~/lib/meta';

const matches = [
  {
    id: 'root',
    data: {
      header: {
        shop: {
          name: 'Lightboard',
          primaryDomain: {url: 'https://lightboard.co.il/'},
        },
      },
    },
  },
];

describe('site name, origin and titles from the root match', () => {
  it('reads the shop name and origin from the root loader data', () => {
    expect(siteName(matches)).toBe('Lightboard');
    expect(siteOrigin(matches)).toBe('https://lightboard.co.il');
  });

  it('falls back safely when the root data is missing or broken', () => {
    expect(siteName(undefined)).toBe('Lightboard');
    expect(siteOrigin([])).toBe('');
    expect(
      siteOrigin([
        {id: 'root', data: {header: {shop: {primaryDomain: {url: 'nope'}}}}},
      ]),
    ).toBe('');
  });

  it('builds "<Site> | <Page>" titles and absolute or relative canonicals', () => {
    expect(pageTitle(matches, 'Cart')).toBe('Lightboard | Cart');
    expect(pageTitle(matches, null)).toBe('Lightboard');
    expect(canonicalUrl(matches, '/cart')).toBe(
      'https://lightboard.co.il/cart',
    );
    expect(canonicalUrl([], '/cart')).toBe('/cart');
  });
});

describe('formatPrice', () => {
  it('formats shekels with ₪ and drops .00', () => {
    expect(formatPrice({amount: '279.0', currencyCode: 'ILS'})).toBe('₪279');
    expect(formatPrice({amount: '279.5', currencyCode: 'ILS'})).toBe('₪279.50');
  });

  it('suffixes other currencies and rejects missing or bad amounts', () => {
    expect(formatPrice({amount: '75', currencyCode: 'USD'})).toBe('75 USD');
    expect(formatPrice({amount: 'abc', currencyCode: 'ILS'})).toBeNull();
    expect(formatPrice(null)).toBeNull();
  });
});

describe('search copy', () => {
  it('homepage copy mentions free shipping in each locale', () => {
    expect(homeSeoCopy('he').description).toContain('משלוח חינם');
    expect(homeSeoCopy('en').description).toContain('free shipping in Israel');
  });

  const product = {title: 'Lightboard', seo: {title: '  ', description: null}};
  const price = {amount: '279.0', currencyCode: 'ILS'};

  it('product copy builds a gift-intent fallback with the price', () => {
    const he = productSeoCopy(product, price, 'he');
    expect(he.title).toContain('Lightboard');
    expect(he.description).toContain('₪279');
    const en = productSeoCopy(product, price, 'en');
    expect(en.title).toContain('Gift for surfers');
    expect(en.description).toContain('₪279, free shipping in Israel.');
  });

  it('a merchant SEO title wins on Hebrew but not on /en', () => {
    const custom = {title: 'Lightboard', seo: {title: 'כותרת מהאדמין'}};
    expect(productSeoCopy(custom, price, 'he').title).toBe('כותרת מהאדמין');
    expect(productSeoCopy(custom, price, 'en').title).not.toBe('כותרת מהאדמין');
  });

  it('Printboard copy mentions the board size', () => {
    const copy = productSeoCopy(
      {title: 'Printboard'},
      price,
      'en',
      'printboard',
    );
    expect(copy.description).toContain('20×50 cm');
  });
});
