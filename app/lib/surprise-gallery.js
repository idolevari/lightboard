/**
 * Curated "surprise me" gallery — brand-aligned surf / van-life / ocean
 * photos already living on the Shopify Files CDN. Used by the photo
 * customizer when a buyer picks the "אפתיעו אותי" option instead of
 * uploading their own three shots.
 *
 * Each entry is a Shopify CDN URL with the image-transform query string
 * baked in (`width=1200&height=1200&crop=center`) so the merchant-facing
 * cart line attribute is already a print-ready square crop — no
 * post-processing needed in the studio.
 *
 * To extend the gallery: drop more photos in Shopify Admin → Content →
 * Files, copy the resulting CDN URL, and append a new entry below.
 */

const SHOPIFY_CDN_PREFIX =
  'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/';

function squareUrl(filename) {
  return `${SHOPIFY_CDN_PREFIX}${filename}?width=1200&height=1200&crop=center`;
}

export const SURPRISE_GALLERY = [
  squareUrl('paulina-herpel-NYsnCI23XJc-unsplash.jpg'),
  squareUrl('john-o-nelio-czM5xBzedXA-unsplash.jpg'),
  squareUrl('leo_visions-SzJo8G7BP8E-unsplash.jpg'),
  squareUrl('mads-schmidt-rasmussen-tSp5_w9h5TQ-unsplash.jpg'),
  squareUrl('mikail-mcverry-6WRjFofNhPs-unsplash.jpg'),
  squareUrl('sean-stratton-iQsa35lj2iE-unsplash.jpg'),
  squareUrl('tim-marshall-hIHh4E4_OGA-unsplash.jpg'),
];

/**
 * Return three distinct random URLs from the gallery. Falls back to
 * repeating the first URL if the gallery has fewer than three entries
 * (shouldn't happen, but keeps the customizer well-behaved).
 *
 * Optionally pass `excludeUrls` so the user re-rolling gets a fresh
 * set instead of a near-identical one.
 *
 * @param {string[]} [excludeUrls]
 * @returns {string[]}
 */
export function pickThreeFromGallery(excludeUrls = []) {
  const pool = SURPRISE_GALLERY.filter((u) => !excludeUrls.includes(u));
  const source = pool.length >= 3 ? pool : SURPRISE_GALLERY.slice();
  // Fisher–Yates shuffle, just enough randomness for "feels different each time".
  for (let i = source.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  const picks = source.slice(0, 3);
  while (picks.length < 3) picks.push(SURPRISE_GALLERY[0]);
  return picks;
}
