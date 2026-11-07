import {describe, expect, it} from 'vitest';
import {CHECKOUT_DOMAIN, brandCheckoutUrl} from '~/lib/checkout-url';

describe('brandCheckoutUrl', () => {
  it('moves myshopify checkout links to the branded domain, keeping path and query', () => {
    expect(
      brandCheckoutUrl(
        'https://kqyxee-us.myshopify.com/cart/c/abc123?key=xyz&locale=he',
      ),
    ).toBe(`https://${CHECKOUT_DOMAIN}/cart/c/abc123?key=xyz&locale=he`);
  });

  it('leaves links that are already on another domain alone', () => {
    const url = `https://${CHECKOUT_DOMAIN}/checkouts/cn/abc`;
    expect(brandCheckoutUrl(url)).toBe(url);
    expect(brandCheckoutUrl('https://shop.app/checkout')).toBe(
      'https://shop.app/checkout',
    );
  });

  it('passes through empty and malformed values', () => {
    expect(brandCheckoutUrl(null)).toBeNull();
    expect(brandCheckoutUrl(undefined)).toBeUndefined();
    expect(brandCheckoutUrl('')).toBe('');
    expect(brandCheckoutUrl('/cart/c/abc')).toBe('/cart/c/abc');
  });

  it('does not match look-alike hosts', () => {
    const url = 'https://evil-myshopify.com.example/cart/c/abc';
    expect(brandCheckoutUrl(url)).toBe(url);
  });
});
