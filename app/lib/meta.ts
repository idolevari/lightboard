/**
 * Helpers for route `meta()` functions.
 *
 * `matches` is the React Router matches array; the root match owns the
 * Storefront `shop` data (name + primaryDomain) fetched in HEADER_QUERY, so
 * any nested route can read it from there.
 */

import {MADE_IN, PHOTOS_PER_BOARD, SHIPPING_FACTS} from '~/lib/brand-facts';
import type {Locale} from '~/lib/i18n';
import type {CustomizerKind} from '~/lib/customizer-config';
import {PRINTBOARD_SIZE_LABEL} from '~/lib/customizer-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-router's MetaArgs `matches` shape is awkward to thread through; we narrow via optional chaining at use sites
type MetaMatch = {id: string; data?: any};

function rootData(matches: ReadonlyArray<MetaMatch> | undefined) {
  return matches?.find?.((m) => m.id === 'root')?.data;
}

export function siteName(
  matches: ReadonlyArray<MetaMatch> | undefined,
): string {
  return rootData(matches)?.header?.shop?.name ?? 'Lightboard';
}

/**
 * Build a "<Site> | <Page>" title with a single source of truth for the
 * site name. Returns just the site name when no page title is provided.
 */
export function pageTitle(
  matches: ReadonlyArray<MetaMatch> | undefined,
  pageTitle?: string | null,
): string {
  const site = siteName(matches);
  if (!pageTitle) return site;
  return `${site} | ${pageTitle}`;
}

/* -------------------------------------------------------------------------- */
/*  Search titles and descriptions                                             */
/* -------------------------------------------------------------------------- */

type SeoCopy = {title: string; description: string};

const FREE_SHIPPING = SHIPPING_FACTS.freeShippingOverILS === 0;

/**
 * Search-result copy for the homepage. Voice from the copy audit (plural
 * "you", concrete nouns), plus the gift intent people search for
 * ("מתנה לגולשים", "gift for surfers"). Facts come from `~/lib/brand-facts`.
 */
export function homeSeoCopy(locale: Locale): SeoCopy {
  if (locale === 'en') {
    return {
      title:
        'Lightboard · A surfboard light with your photos | Gift for surfers',
      description: `A solid-pine surfboard for your wall, with warm LED light and ${PHOTOS_PER_BOARD} photos you choose. Handmade to order in ${MADE_IN.en}${FREE_SHIPPING ? ', free shipping in Israel' : ''}. A gift for surfers and ocean lovers.`,
    };
  }
  return {
    title: 'Lightboard · גלשן קיר עם התמונות שלכם | מתנה לגולשים',
    description: `גלשן קיר מאורן מלא, עם אור לד חם ושלוש תמונות שאתם בוחרים. עבודת יד ב${MADE_IN.he}, בהזמנה אישית${FREE_SHIPPING ? ', משלוח חינם לכל הארץ' : ''}. מתנה לגולשים ולחובבי ים.`,
  };
}

type PriceLike = {amount: string; currencyCode: string} | null | undefined;

export function formatPrice(price: PriceLike): string | null {
  if (!price?.amount) return null;
  const n = Number(price.amount);
  if (!Number.isFinite(n)) return null;
  const value = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return price.currencyCode === 'ILS'
    ? `₪${value}`
    : `${value} ${price.currencyCode}`;
}

/**
 * Search-result copy for a product page. A merchant-set SEO title or
 * description (Shopify Admin → product → Search engine listing) wins on the
 * Hebrew site. Otherwise, and always on /en (the Shopify SEO fields hold
 * Hebrew), a gift-intent fallback built from live product data is used.
 */
export function productSeoCopy(
  product: {
    title: string;
    seo?: {title?: string | null; description?: string | null} | null;
  },
  price: PriceLike,
  locale: Locale,
  kind: CustomizerKind | null = 'lightboard',
): SeoCopy {
  const p = formatPrice(price);
  if (kind === 'printboard') return printboardSeoCopy(product, p, locale);
  if (locale === 'en') {
    const offer = [p, FREE_SHIPPING ? 'free shipping in Israel' : null]
      .filter(Boolean)
      .join(', ');
    return {
      title: `${product.title} · LED surfboard photo display | Gift for surfers`,
      description: [
        `A solid-pine surfboard wall light with warm LEDs and ${PHOTOS_PER_BOARD} of your photos. Handmade to order in ${MADE_IN.en}.`,
        offer ? `${offer}.` : '',
        'A personal gift for surfers and ocean lovers.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  const offer = [p, FREE_SHIPPING ? 'משלוח חינם לכל הארץ' : null]
    .filter(Boolean)
    .join(', ');
  return {
    title:
      product.seo?.title?.trim() ||
      `${product.title} · מתלה תמונות מואר בצורת גלשן | מתנה לגולשים`,
    description:
      product.seo?.description?.trim() ||
      [
        `גלשן קיר מאורן מלא עם אור לד חם ושלוש תמונות שאתם בוחרים. עבודת יד בהזמנה אישית ב${MADE_IN.he}.`,
        offer ? `${offer}.` : '',
        'מתנה אישית לגולשים ולחובבי ים.',
      ]
        .filter(Boolean)
        .join(' '),
  };
}

/** Printboard: a wooden fish board with one photo printed on the wood. */
function printboardSeoCopy(
  product: {
    title: string;
    seo?: {title?: string | null; description?: string | null} | null;
  },
  p: string | null,
  locale: Locale,
): SeoCopy {
  if (locale === 'en') {
    const offer = [p, FREE_SHIPPING ? 'free shipping in Israel' : null]
      .filter(Boolean)
      .join(', ');
    return {
      title: `${product.title} · Your photo printed on a wooden surfboard | Gift for surfers`,
      description: [
        `A ${PRINTBOARD_SIZE_LABEL} cm wooden surfboard for your wall, with your photo or one of our designs printed straight on the wood. Handmade to order.`,
        offer ? `${offer}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  const offer = [p, FREE_SHIPPING ? 'משלוח חינם לכל הארץ' : null]
    .filter(Boolean)
    .join(', ');
  return {
    title:
      product.seo?.title?.trim() ||
      'Printboard · גלשן עץ עם התמונה שלכם | מתנה לגולשים',
    description:
      product.seo?.description?.trim() ||
      [
        `גלשן עץ לקיר בגודל ${PRINTBOARD_SIZE_LABEL} ס״מ, עם התמונה שלכם או אחד העיצובים שלנו מודפסים ישירות על העץ. עבודת יד בהזמנה אישית.`,
        offer ? `${offer}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
  };
}
