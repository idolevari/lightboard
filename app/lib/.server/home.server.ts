/**
 * Server-only shaping of the homepage product cards: pick the carousel
 * photos and sanitize the HTML headline before anything reaches the client.
 */
import type {HomeProductCardFragment} from 'storefrontapi.generated';
import type {CarouselImage} from '~/components/ProductCarousel';
import type {HomeProductCard} from '~/lib/home/types';
import {sanitizeShopifyHtml} from '~/lib/.server/sanitize.server';

/** Max photos in a homepage product carousel. */
const CAROUSEL_MAX = 6;

const withoutQuery = (url: string) => url.split('?')[0];

/**
 * Pick the homepage carousel photos from the product's images, in Admin
 * order: drop the per-variant renders (any image a variant points at, or the
 * old 920×920 "Lightboard surfboard — <color>" PNGs), but always keep the
 * product's featured image. With `lifestyleFirst`, the portrait lifestyle
 * shots come right after the first photo, ahead of the square ones.
 */
function pickCarouselImages(
  product: HomeProductCardFragment,
  {lifestyleFirst = false}: {lifestyleFirst?: boolean} = {},
): Array<CarouselImage> {
  const featured = product.featuredImage?.url
    ? withoutQuery(product.featuredImage.url)
    : null;
  const variantUrls = new Set(
    product.variants.nodes
      .map((v) => v.image?.url)
      .filter((url): url is string => Boolean(url))
      .map(withoutQuery),
  );
  const kept = product.images.nodes.filter((image) => {
    const url = withoutQuery(image.url);
    if (url === featured) return true;
    if (variantUrls.has(url)) return false;
    return !/^Lightboard surfboard/i.test(image.altText ?? '');
  });
  if (!lifestyleFirst || kept.length < 3) return kept.slice(0, CAROUSEL_MAX);
  const [first, ...rest] = kept;
  const portrait = (i: (typeof kept)[number]) =>
    (i.height ?? 0) > (i.width ?? 0);
  return [
    first,
    ...rest.filter(portrait),
    ...rest.filter((i) => !portrait(i)),
  ].slice(0, CAROUSEL_MAX);
}

/**
 * The featured product's `headline_*` metafields are rendered as HTML.
 * Sanitize them here (server only) so sanitize-html stays out of the client
 * bundle; the component renders the already-clean string.
 */
function sanitizeFeaturedHeadline<
  T extends {
    headline_he?: {value: string} | null;
    headline_en?: {value: string} | null;
  },
>(product: T | null): T | null {
  if (!product) return null;
  const clean = (field: {value: string} | null | undefined) =>
    field ? {...field, value: sanitizeShopifyHtml(field.value)} : field;
  return {
    ...product,
    headline_he: clean(product.headline_he),
    headline_en: clean(product.headline_en),
  };
}

export function toHomeProductCard(
  product: HomeProductCardFragment | null | undefined,
  options?: {lifestyleFirst?: boolean},
): HomeProductCard | null {
  if (!product) return null;
  const carousel = pickCarouselImages(product, options);
  const clean = sanitizeFeaturedHeadline(product) ?? product;
  // Ship only the picked photos; the raw image / variant lists stay server-side.
  const card: Partial<HomeProductCardFragment> = {...clean};
  delete card.images;
  delete card.variants;
  return {
    ...(card as Omit<HomeProductCardFragment, 'images' | 'variants'>),
    carousel,
  };
}
