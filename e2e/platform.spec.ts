import {expect, test} from '@playwright/test';
import type {APIRequestContext} from '@playwright/test';
import {bypassHeaders} from './env';
import {PRODUCT_PATH, PRODUCT_PRICE} from './support';

/**
 * SEO / platform smoke checks over plain HTTP. They don't depend on the
 * viewport, so they run once (mobile project only).
 */
test.skip(({isMobile}) => !isMobile, 'HTTP-only checks run in one project');
// API-only file (no pages), so the bypass header can go on every request.
test.use({extraHTTPHeaders: bypassHeaders()});

type JsonLdNode = {'@type'?: string | string[]; [key: string]: unknown};

async function jsonLdNodes(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status()).toBe(200);
  const html = await res.text();
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => m[1]);
  expect(blocks.length, `JSON-LD on ${path}`).toBeGreaterThan(0);
  return blocks.flatMap((raw) => {
    const parsed = JSON.parse(raw) as JsonLdNode | JsonLdNode[];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.flatMap((n) =>
      Array.isArray(n['@graph']) ? (n['@graph'] as JsonLdNode[]) : [n],
    );
  });
}

const typesOf = (nodes: JsonLdNode[]) => nodes.flatMap((n) => n['@type'] ?? []);

test('robots.txt allows crawling and points at the sitemap', async ({
  request,
}) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^text\/plain/);
  const body = await res.text();
  expect(body).toMatch(/^User-agent: \*/m);
  expect(body).toMatch(/^Disallow: \/api\//m);
  expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
});

test('sitemap.xml is a valid index without Shopify locale prefixes', async ({
  request,
}) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);
  const index = await res.text();
  expect(index).toContain('<sitemapindex');
  expect(index).not.toMatch(/\/EN-US\b/i);

  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(children.length).toBeGreaterThan(0);
  const products = children.find((u) => u.includes('/sitemap/products/'));
  expect(products, 'products child sitemap').toBeTruthy();
  // Child sitemap URLs carry the canonical host; fetch them from the target.
  const childRes = await request.get(new URL(products!).pathname);
  expect(childRes.status()).toBe(200);
  const urls = await childRes.text();
  expect(urls).toContain(PRODUCT_PATH);
  expect(urls).not.toMatch(/\/EN-US\b/i);
});

test('llms.txt is served as markdown', async ({request}) => {
  const res = await request.get('/llms.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^text\/markdown/);
  expect(await res.text()).toMatch(/^# /);
});

test('legacy WooCommerce URLs 301 to the new product page', async ({
  request,
}) => {
  const res = await request.get('/product/lightboard/', {maxRedirects: 0});
  expect(res.status()).toBe(301);
  expect(new URL(res.headers().location, 'http://x').pathname).toBe(
    PRODUCT_PATH,
  );
});

test('home page JSON-LD parses and describes the store', async ({request}) => {
  const types = typesOf(await jsonLdNodes(request, '/'));
  expect(types).toEqual(expect.arrayContaining(['OnlineStore', 'WebSite']));
});

test('product JSON-LD parses and offers the board', async ({request}) => {
  const nodes = await jsonLdNodes(request, PRODUCT_PATH);
  const group = nodes.find((n) => typesOf([n]).includes('ProductGroup'));
  expect(group, 'ProductGroup node').toBeTruthy();
  const variants = (group!.hasVariant ?? []) as Array<{
    offers?: {price?: string | number; priceCurrency?: string};
  }>;
  expect(variants).toHaveLength(3);
  for (const v of variants) {
    expect(Number(v.offers?.price)).toBe(Number(PRODUCT_PRICE));
    expect(v.offers?.priceCurrency).toBe('ILS');
  }
});

test('production CSP does not allow localhost', async ({request}) => {
  const res = await request.get('/');
  const html = await res.text();
  test.skip(
    html.includes('/@vite/client'),
    'Vite dev server: CSP intentionally allows localhost',
  );
  const csp = res.headers()['content-security-policy'];
  expect(csp, 'Content-Security-Policy header').toBeTruthy();
  expect(csp).not.toMatch(/localhost/);
  expect(csp).toMatch(/frame-ancestors 'none'/);
});

test('cross-origin photo upload is rejected without touching Shopify Files', async ({
  request,
}) => {
  // No file in the body: the origin check must refuse it before parsing.
  const res = await request.post('/api/photos/upload', {
    headers: {
      origin: 'https://evil.example',
      'sec-fetch-site': 'cross-site',
    },
    form: {cartId: 'e2e'},
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toEqual({error: 'forbidden'});
});
