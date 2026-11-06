import {describe, expect, it} from 'vitest';
import {sanitizeShopifyHtml} from '~/lib/.server/sanitize.server';

describe('sanitizeShopifyHtml', () => {
  it('returns an empty string for non-strings and empty input', () => {
    expect(sanitizeShopifyHtml(undefined)).toBe('');
    expect(sanitizeShopifyHtml(42)).toBe('');
    expect(sanitizeShopifyHtml('')).toBe('');
  });

  it('keeps allowed prose, list and table markup', () => {
    const html =
      '<h2 class="t">כותרת</h2><p dir="rtl"><strong>a</strong> <em>b</em></p><ul><li>x</li></ul><table><tbody><tr><td>1</td></tr></tbody></table>';
    expect(sanitizeShopifyHtml(html)).toBe(html);
  });

  it('strips scripts, iframes, forms and inline styles', () => {
    const out = sanitizeShopifyHtml(
      '<p style="color:red">hi</p><script>alert(1)</script><iframe src="https://x"></iframe><form><input></form>',
    );
    expect(out).toBe('<p>hi</p>');
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeShopifyHtml(
      '<img src="https://cdn.shopify.com/a.jpg" onerror="alert(1)" alt="a"><p onclick="x()">t</p>',
    );
    expect(out).not.toMatch(/onerror|onclick|alert/);
    expect(out).toContain(
      '<img src="https://cdn.shopify.com/a.jpg" alt="a" />',
    );
  });

  it('removes javascript:, data: and protocol-relative URLs', () => {
    expect(
      sanitizeShopifyHtml('<a href="javascript:alert(1)">x</a>'),
    ).not.toContain('javascript');
    expect(
      sanitizeShopifyHtml('<img src="data:image/png;base64,AAAA">'),
    ).not.toContain('data:');
    expect(sanitizeShopifyHtml('<a href="//evil.example">x</a>')).not.toContain(
      'evil.example',
    );
  });

  it('forces rel="noreferrer noopener" on links and keeps mailto/tel', () => {
    expect(
      sanitizeShopifyHtml(
        '<a href="https://x.example" target="_blank" rel="opener">x</a>',
      ),
    ).toBe(
      '<a href="https://x.example" target="_blank" rel="noreferrer noopener">x</a>',
    );
    expect(sanitizeShopifyHtml('<a href="tel:+972557209448">t</a>')).toContain(
      'href="tel:+972557209448"',
    );
  });
});
