import {describe, expect, it} from 'vitest';
import type {MetaDescriptor} from 'react-router';
import {
  SITE_URL,
  absoluteUrl,
  alternateLinks,
  buildAlternates,
  metaLocale,
  routeMeta,
} from '~/lib/seo-urls';
import {rootSeo} from '~/lib/.server/seo.server';

function rootMatch(locale: 'he' | 'en', pathnameNoLocale: string) {
  return {
    data: {
      locale,
      pathnameNoLocale,
      seo: rootSeo({locale, pathnameNoLocale}).seo,
    },
  };
}

function find(
  meta: Array<MetaDescriptor>,
  pred: (t: Record<string, unknown>) => boolean,
) {
  return meta.find((t) => pred(t as Record<string, unknown>)) as
    | Record<string, unknown>
    | undefined;
}

describe('absoluteUrl', () => {
  it('keeps Hebrew unprefixed and puts English under /en', () => {
    expect(absoluteUrl('/', 'he')).toBe(`${SITE_URL}/`);
    expect(absoluteUrl('/', 'en')).toBe(`${SITE_URL}/en`);
    expect(absoluteUrl('/products/lightboard', 'he')).toBe(
      `${SITE_URL}/products/lightboard`,
    );
    expect(absoluteUrl('/products/lightboard', 'en')).toBe(
      `${SITE_URL}/en/products/lightboard`,
    );
  });
});

describe('hreflang alternates', () => {
  it('lists he, en and an x-default that points at the Hebrew page', () => {
    expect(buildAlternates('/cart')).toEqual([
      {rel: 'alternate', hrefLang: 'he', href: `${SITE_URL}/cart`},
      {rel: 'alternate', hrefLang: 'en', href: `${SITE_URL}/en/cart`},
      {rel: 'alternate', hrefLang: 'x-default', href: `${SITE_URL}/cart`},
    ]);
  });

  it('emits <link> descriptors, or nothing without a path', () => {
    const links = alternateLinks('/');
    expect(links).toHaveLength(3);
    expect(
      links.every((l) => (l as {tagName?: string}).tagName === 'link'),
    ).toBe(true);
    expect(alternateLinks(null)).toEqual([]);
    expect(alternateLinks('')).toEqual([]);
  });
});

describe('routeMeta', () => {
  it('drops the doubled brand when the page title already names it', () => {
    const meta = routeMeta({
      matches: [rootMatch('he', '/')],
      data: {seo: {title: 'Lightboard · גלשן קיר'}},
    });
    expect(find(meta, (t) => typeof t.title === 'string')?.title).toBe(
      'Lightboard · גלשן קיר',
    );
    expect(find(meta, (t) => t.property === 'og:title')?.content).toBe(
      'Lightboard · גלשן קיר',
    );
  });

  it('keeps the brand suffix on titles that do not mention it', () => {
    const meta = routeMeta({
      matches: [rootMatch('he', '/cart')],
      data: {seo: {title: 'סל קניות'}},
    });
    expect(find(meta, (t) => typeof t.title === 'string')?.title).toBe(
      'סל קניות | Lightboard',
    );
  });

  it('also treats the Hebrew brand spelling as the brand', () => {
    const meta = routeMeta({
      matches: [rootMatch('he', '/')],
      data: {seo: {title: 'לייטבורד'}},
    });
    expect(find(meta, (t) => typeof t.title === 'string')?.title).toBe(
      'לייטבורד',
    );
  });

  it('gives the Hebrew homepage a canonical with the trailing slash', () => {
    const meta = routeMeta({matches: [rootMatch('he', '/')]});
    expect(find(meta, (t) => t.rel === 'canonical')?.href).toBe(`${SITE_URL}/`);
  });

  it('adds hreflang links, og:locale for the page and the other locale as alternate', () => {
    const meta = routeMeta({matches: [rootMatch('en', '/cart')]});
    const hreflangs = meta
      .map((t) => (t as {hrefLang?: string}).hrefLang)
      .filter(Boolean);
    expect(hreflangs).toEqual(['he', 'en', 'x-default']);
    expect(find(meta, (t) => t.property === 'og:locale')?.content).toBe(
      'en_IL',
    );
    expect(
      find(meta, (t) => t.property === 'og:locale:alternate')?.content,
    ).toBe('he_IL');
    expect(find(meta, (t) => t.property === 'og:type')?.content).toBe(
      'website',
    );
  });

  it('honours ogType and appends extra descriptors last', () => {
    const extra = {property: 'product:price:amount', content: '279'};
    const meta = routeMeta({
      matches: [rootMatch('he', '/products/lightboard')],
      ogType: 'product',
      extra: [extra],
    });
    expect(find(meta, (t) => t.property === 'og:type')?.content).toBe(
      'product',
    );
    expect(meta.at(-1)).toEqual(extra);
  });

  it('defaults to Hebrew when the root match has no data', () => {
    expect(metaLocale([])).toBe('he');
    expect(metaLocale([rootMatch('en', '/')])).toBe('en');
  });
});
