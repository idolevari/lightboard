import {describe, expect, it} from 'vitest';
import {
  DELIVERY_SPLIT,
  LEAD_TIME_BUSINESS_DAYS,
  REQUIRES_PHOTOS_TAG,
  REQUIRES_PRINT_PHOTO_TAG,
  SHIPPING_FACTS,
  isPersonalized,
} from '~/lib/brand-facts';

describe('brand facts', () => {
  it('promises delivery in 5–7 business days', () => {
    expect(LEAD_TIME_BUSINESS_DAYS).toEqual({min: 5, max: 7});
  });

  it('splits the lead time into handling + transit that add up to the total', () => {
    const {handling, transit} = DELIVERY_SPLIT;
    expect(handling.min + transit.min).toBe(LEAD_TIME_BUSINESS_DAYS.min);
    expect(handling.max + transit.max).toBe(LEAD_TIME_BUSINESS_DAYS.max);
  });

  it('ships free on every order, inside Israel only', () => {
    expect(SHIPPING_FACTS.freeShippingOverILS).toBe(0);
    expect(SHIPPING_FACTS.shipsTo).toEqual(['IL']);
  });
});

describe('isPersonalized', () => {
  it('is true for the Lightboard and the Printboard customizer tags', () => {
    expect(isPersonalized([REQUIRES_PHOTOS_TAG])).toBe(true);
    expect(isPersonalized(['gift', REQUIRES_PRINT_PHOTO_TAG])).toBe(true);
  });

  it('is false for untagged or missing tag lists', () => {
    expect(isPersonalized(['gift', 'surf'])).toBe(false);
    expect(isPersonalized([])).toBe(false);
    expect(isPersonalized(null)).toBe(false);
    expect(isPersonalized(undefined)).toBe(false);
  });
});
