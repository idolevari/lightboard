import {describe, expect, it, vi} from 'vitest';
import {
  hasExplicitMarketingConsent,
  openCookiePreferences,
} from '~/lib/consent';

function privacy(marketing: 'yes' | 'no' | '', allowed: boolean) {
  return {
    marketingAllowed: () => allowed,
    currentVisitorConsent: () => ({marketing}),
  };
}

describe('hasExplicitMarketingConsent', () => {
  it('is true only when the visitor said yes and Shopify allows marketing', () => {
    expect(hasExplicitMarketingConsent(privacy('yes', true))).toBe(true);
  });

  it('is false when Shopify allows marketing but no choice was recorded', () => {
    // Regions without a configured banner report marketingAllowed() = true.
    expect(hasExplicitMarketingConsent(privacy('', true))).toBe(false);
    expect(hasExplicitMarketingConsent(privacy('no', true))).toBe(false);
    expect(hasExplicitMarketingConsent(privacy('yes', false))).toBe(false);
  });

  it('is false when the Customer Privacy API is missing or partial', () => {
    expect(hasExplicitMarketingConsent({})).toBe(false);
    // Node has no window: nothing to read, so no consent.
    expect(hasExplicitMarketingConsent()).toBe(false);
  });

  it('reads window.Shopify.customerPrivacy when not passed one', () => {
    vi.stubGlobal('window', {
      Shopify: {customerPrivacy: privacy('yes', true)},
    });
    expect(hasExplicitMarketingConsent()).toBe(true);
  });
});

describe('openCookiePreferences', () => {
  it('returns false on the server', () => {
    expect(openCookiePreferences()).toBe(false);
  });

  it('returns false before the privacy banner script has loaded', () => {
    vi.stubGlobal('window', {});
    expect(openCookiePreferences()).toBe(false);
  });

  it('opens the banner preferences when available', () => {
    const showPreferences = vi.fn();
    vi.stubGlobal('window', {privacyBanner: {showPreferences}});
    expect(openCookiePreferences()).toBe(true);
    expect(showPreferences).toHaveBeenCalledOnce();
  });
});
