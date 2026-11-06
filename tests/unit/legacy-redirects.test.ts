import {describe, expect, it} from 'vitest';
import {
  PENDING_PRODUCTS,
  legacyRedirect,
} from '~/lib/.server/legacy-redirects';

const ORIGIN = 'https://lightboard.co.il';

function get(path: string, method = 'GET'): Response | null {
  return legacyRedirect(new Request(`${ORIGIN}${path}`, {method}));
}

function target(path: string): string | null {
  return get(path)?.headers.get('Location') ?? null;
}

describe('legacyRedirect', () => {
  it('301s a migrated WooCommerce product to its Shopify product page', () => {
    const res = get('/product/lightboard/');
    expect(res?.status).toBe(301);
    expect(res?.headers.get('Location')).toBe(`${ORIGIN}/products/lightboard`);
    expect(res?.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('maps old shop, account and content pages to their new homes', () => {
    expect(target('/shop')).toBe(`${ORIGIN}/collections/all`);
    expect(target('/checkout/')).toBe(`${ORIGIN}/cart`);
    expect(target('/my-account')).toBe(`${ORIGIN}/account`);
    expect(target('/about')).toBe(`${ORIGIN}/#story`);
    expect(target('/refund_returns')).toBe(
      `${ORIGIN}/policies/refund-policy`,
    );
    expect(target('/feed')).toBe(`${ORIGIN}/`);
  });

  it('decodes percent-encoded Hebrew slugs before matching', () => {
    expect(target(`/${encodeURIComponent('צרו-קשר')}/`)).toBe(
      `${ORIGIN}/pages/contact`,
    );
    expect(target(`/${encodeURIComponent('הצהרת-נגישות')}`)).toBe(
      `${ORIGIN}/pages/accessibility`,
    );
    expect(target(`/${encodeURIComponent('מדיניות-פרטיות')}`)).toBe(
      `${ORIGIN}/policies/privacy-policy`,
    );
  });

  it('matches case-insensitively and ignores repeated trailing slashes', () => {
    expect(target('/SHOP//')).toBe(`${ORIGIN}/collections/all`);
    expect(target('/Privacy-Policy')).toBe(`${ORIGIN}/policies/privacy-policy`);
  });

  it('sends every /my-account/* sub-page to /account', () => {
    expect(target('/my-account/orders/')).toBe(`${ORIGIN}/account`);
    expect(target('/My-Account/edit-address/billing')).toBe(
      `${ORIGIN}/account`,
    );
  });

  it('sends pending and unknown product slugs to the catalogue', () => {
    expect(PENDING_PRODUCTS.has('surf-prints')).toBe(true);
    expect(target('/product/surf-prints/')).toBe(`${ORIGIN}/collections/all`);
    expect(
      target(`/product/${encodeURIComponent('מתלה-סקייטבורד')}`),
    ).toBe(`${ORIGIN}/collections/all`);
    expect(target('/product/never-existed')).toBe(`${ORIGIN}/collections/all`);
  });

  it('sends product category and tag archives to the catalogue', () => {
    expect(target('/product-category/surf/')).toBe(`${ORIGIN}/collections/all`);
    expect(target('/product-tag/gift')).toBe(`${ORIGIN}/collections/all`);
  });

  it('returns null for paths it does not know', () => {
    expect(get('/products/lightboard')).toBeNull();
    expect(get('/random-page')).toBeNull();
    expect(get('/product/a/b')).toBeNull();
    expect(get('/')).toBeNull();
  });

  it('only redirects GET and HEAD', () => {
    expect(get('/shop', 'HEAD')?.status).toBe(301);
    expect(get('/shop', 'POST')).toBeNull();
  });

  it('returns null instead of throwing on a malformed percent-encoding', () => {
    expect(get('/%E0%A4%A')).toBeNull();
  });

  it('keeps the redirect on the request origin', () => {
    const res = legacyRedirect(
      new Request('https://dev.example.test/shop', {method: 'GET'}),
    );
    expect(res?.headers.get('Location')).toBe(
      'https://dev.example.test/collections/all',
    );
  });
});
