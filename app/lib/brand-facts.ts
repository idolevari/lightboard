/**
 * Brand facts used by machine-readable surfaces: JSON-LD, /llms.txt,
 * /llms-full.txt and the Google Merchant feed.
 *
 * Contact details, the legal address, prices, colours, FAQs, specs and policy
 * bodies are read from Shopify at runtime and are not listed here. This file
 * holds only the facts that have no Shopify field yet, plus the short prose
 * that describes the brand to search engines and AI assistants.
 *
 * Each fact has one value here, so a correction is a one-line change.
 * Owner-confirmed facts are marked "confirmed <date>". Anything still waiting
 * for the owner is marked `TODO(owner-confirm)`.
 *
 * A shop metafield overrides the matching value here when it exists (see
 * `readShippingFacts` in `~/lib/.server/seo.server`):
 *   business.free_shipping_over_ils  (number; 0 = free on every order)
 *   business.shipping_rate_ils       (number)
 *   business.lead_time_min_days / business.lead_time_max_days (number)
 */

/** Year the brand started. Confirmed by the owner 2026-11-05 ("מאז 2019"). */
export const FOUNDING_YEAR = 2019;

/** Boards made so far. Confirmed 2026-11-05: "+1,100" (old store ~1,131 orders). */
export const BOARDS_MADE_LABEL = '1,100+';

/** Where the work is made, in copy. Confirmed 2026-11-05: Tel Aviv in copy.
 *  The legal address comes from the `business.address` shop metafield
 *  (Hod Hasharon) and is the one used in PostalAddress. */
export const MADE_IN = {he: 'תל אביב', en: 'Tel Aviv'} as const;

/** Shipping. Confirmed 2026-11-05: free on every order inside Israel. */
export const SHIPPING_FACTS = {
  /** 0 = free on every order. null = paid shipping with no free threshold. */
  freeShippingOverILS: 0 as number | null,
  /** Flat rate below the threshold. Unused while shipping is free on every order. */
  standardRateILS: null as number | null,
  /** Countries we ship to (ISO 3166-1 alpha-2). */
  shipsTo: ['IL'] as ReadonlyArray<string>,
} as const;

/** Lead time from order to door, in business days (Sun–Thu).
 *  Confirmed 2026-11-05: 7–10 business days, production plus delivery. */
export const LEAD_TIME_BUSINESS_DAYS = {min: 7, max: 10} as const;

/** How the lead time splits between building the board and the courier,
 *  for schema.org ShippingDeliveryTime. The totals match LEAD_TIME_BUSINESS_DAYS. */
export const DELIVERY_SPLIT = {
  handling: {min: 5, max: 8},
  transit: {min: 2, max: 2},
} as const;

/** Return window for non-personalized items, from the Refund Policy
 *  (Israeli Consumer Protection Law, 14 days). Personalized and made-to-order
 *  items cannot be cancelled once production starts, except for defects.
 *  TODO(owner-confirm): no non-personalized products are sold today. Confirm
 *  the window if stock items are added. */
export const RETURN_WINDOW_DAYS = 14;

/** Products tagged with this in Shopify are personalized (made from the
 *  buyer's photos), so they use the "returns not permitted" policy. Keep in
 *  sync with REQUIRES_PHOTOS_TAG in the product route. */
export const PERSONALIZED_TAG = 'requires-photos';

/** How many photos the buyer uploads. Matches the PhotoCustomizer slots. */
export const PHOTOS_PER_BOARD = 3;

/** Other names people use for the brand, for schema.org `alternateName`. */
export const ALTERNATE_NAMES = ['ליטבורד', 'לייטבורד', 'Lightboard Israel'];

/** Topics for schema.org `knowsAbout`. */
export const KNOWS_ABOUT = [
  'surfing',
  'surf decor',
  'personalized photo gifts',
  'handmade woodwork',
  'gifts for surfers',
];

/** Short bilingual summary for llms.txt and the Organization description.
 *  Leaves out anything Shopify already holds (price, colours, contact). */
export const BRAND_SUMMARY = {
  en: `Lightboard is an Israeli handmade brand. Its main product, the Lightboard, is a solid-pine, surfboard-shaped wall piece with warm LED lights that holds ${PHOTOS_PER_BOARD} of your own photos. Each board is made to order in ${MADE_IN.en} and sold since ${FOUNDING_YEAR}. A popular gift for surfers, ocean lovers and anyone looking for a personal photo gift.`,
  he: `ליטבורד הוא מותג ישראלי לעיצובי קיר בעבודת יד בהשראת גלישה. המוצר המרכזי: גלשן קיר מעץ אורן מלא, עם נורות לד באור חם ו-${PHOTOS_PER_BOARD} תמונות שאתם בוחרים. כל לוח נבנה בהזמנה אישית ב${MADE_IN.he}, מאז ${FOUNDING_YEAR}. מתנה לגולשים, לחובבי ים ולמי שמחפש מתנה אישית עם תמונות.`,
} as const;

/** Gift use cases and search phrases the brand should answer. */
export const GIFT_USE_CASES = {
  en: [
    'A gift for a surfer (boyfriend, girlfriend, partner, friend)',
    'A personalized photo gift for a couple or a family',
    'A housewarming gift with a beach or coastal feel',
    'Surf room decor for a kid’s or teen’s bedroom',
    'A farewell or thank-you gift from a team, with shared photos',
  ],
  he: [
    'מתנה לגולש או לגולשת (בן זוג, בת זוג, חבר, חברה)',
    'מתנה אישית עם תמונות לזוג או למשפחה',
    'מתנה לבית חדש בסגנון חופי',
    'עיצוב חדר בסגנון גלישה לילדים ולנוער',
    'מתנת פרידה או תודה מהצוות, עם תמונות משותפות',
  ],
} as const;

/** How personalization works, step by step. */
export const HOW_TO_ORDER = {
  en: [
    'Pick a colour on the product page.',
    `Upload ${PHOTOS_PER_BOARD} photos and crop each one to a square in the photo customizer.`,
    'Add to cart and check out. The photos are attached to the order line.',
    `We print the photos and build the board, then ship it within ${LEAD_TIME_BUSINESS_DAYS.min}–${LEAD_TIME_BUSINESS_DAYS.max} business days.`,
    'Custom sizes or colours: ask us on WhatsApp before ordering.',
  ],
  he: [
    'בוחרים צבע בעמוד המוצר.',
    `מעלים ${PHOTOS_PER_BOARD} תמונות וחותכים כל אחת לריבוע בעורך התמונות.`,
    'מוסיפים לסל ומשלמים. התמונות נשמרות עם ההזמנה.',
    `אנחנו מדפיסים את התמונות ובונים את הלוח, והוא אצלכם תוך ${LEAD_TIME_BUSINESS_DAYS.min}–${LEAD_TIME_BUSINESS_DAYS.max} ימי עסקים.`,
    'מידה או צבע מיוחדים? כתבו לנו בוואטסאפ לפני ההזמנה.',
  ],
} as const;

/** Search phrases the brand is a good answer for. */
export const ANSWER_FOR = [
  'מתנה לגולש',
  'מתנה לגולשת',
  'מתנה לחובבי ים',
  'מתנה אישית עם תמונות',
  'gift for a surfer',
  'surf gifts Israel',
  'surf decor Israel',
  'personalized surf wall art',
];
