/**
 * Brand lifestyle photography hosted in Shopify Files (owner preference:
 * CDN over /public). Shared by the homepage, PDP, cart and 404.
 *
 * Uploaded 2026-11-05 (resized to ≤2400px long edge, JPEG q80, EXIF
 * stripped). All Unsplash License — free commercial use, no attribution
 * required (https://unsplash.com/license):
 *  - lightboard-01-van-surfboard-sunset.jpg      Jon Matthews       unsplash.com/photos/WFAriFy7dnc
 *  - lightboard-02-golden-hour-wave.jpg          Linus Nylund       unsplash.com/photos/SfdwxMA5VIM
 *  - lightboard-03-van-bed-ocean-view.jpg        Jeremy Bishop      unsplash.com/photos/XGH2-MqgRHw
 *  - lightboard-04-van-bluff-sunset.jpg          Daniel J. Schwarz  unsplash.com/photos/BYpSugXOVEI
 *  - lightboard-05-camper-cliff-coast.jpg        Toms               unsplash.com/photos/ryfptJi3fAM
 *  - lightboard-06-surfer-walk-golden.jpg        James Watson       unsplash.com/photos/kOrxc278PeQ
 *  - lightboard-07-surfer-silhouette-dusk.jpg    Lucas Davies       unsplash.com/photos/M84BX9RmcZA
 */
export const SHOPIFY_FILES_CDN =
  'https://cdn.shopify.com/s/files/1/0982/9325/2392/files';

const CDN = SHOPIFY_FILES_CDN;

export type BrandPhoto = {url: string; w: number; h: number};

export const PHOTOS = {
  vanSunset: {url: `${CDN}/lightboard-01-van-surfboard-sunset.jpg?v=1793910804`, w: 2400, h: 1600},
  goldenWave: {url: `${CDN}/lightboard-02-golden-hour-wave.jpg?v=1793910803`, w: 2400, h: 1602},
  vanBed: {url: `${CDN}/lightboard-03-van-bed-ocean-view.jpg?v=1793910803`, w: 1601, h: 2400},
  vanBluff: {url: `${CDN}/lightboard-04-van-bluff-sunset.jpg?v=1793910804`, w: 1800, h: 2400},
  camperCliff: {url: `${CDN}/lightboard-05-camper-cliff-coast.jpg?v=1793910804`, w: 1600, h: 2400},
  surferWalk: {url: `${CDN}/lightboard-06-surfer-walk-golden.jpg?v=1793910804`, w: 2400, h: 1263},
  surferDusk: {url: `${CDN}/lightboard-07-surfer-silhouette-dusk.jpg?v=1793910803`, w: 2400, h: 1600},
} satisfies Record<string, BrandPhoto>;

export function withParams(url: string, params: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${params}`;
}

/** Plain width srcset, never asking the CDN for more pixels than exist. */
export function widthSrcSet(
  url: string,
  widths: Array<number>,
  srcWidth?: number,
): string {
  const list = srcWidth
    ? widths.filter((w) => w < srcWidth).concat(Math.min(srcWidth, widths[widths.length - 1]))
    : widths;
  return Array.from(new Set(list))
    .map((w) => `${withParams(url, `width=${w}`)} ${w}w`)
    .join(', ');
}

/**
 * Exact aspect-ratio crop around a focal point, straight from the Shopify
 * CDN (`crop=region`). `ratio` is width / height (9/16 for a portrait phone
 * hero, 4/5 for a card). Without the source size it falls back to the
 * named left/center/right crop.
 */
export function cropSrcSet(
  url: string,
  {
    ratio,
    focalX = '50%',
    focalY = '50%',
    srcW,
    srcH,
    widths = [540, 720, 900, 1080, 1350],
  }: {
    ratio: number;
    focalX?: string;
    focalY?: string;
    srcW?: number;
    srcH?: number;
    widths?: Array<number>;
  },
): string {
  const fx = clamp01(parseFloat(focalX) / 100);
  const fy = clamp01(parseFloat(focalY) / 100);
  if (srcW && srcH) {
    let cw = Math.round(srcH * ratio);
    let ch = srcH;
    if (cw > srcW) {
      cw = srcW;
      ch = Math.round(srcW / ratio);
    }
    const left = Math.round(Math.min(Math.max(fx * srcW - cw / 2, 0), srcW - cw));
    const top = Math.round(Math.min(Math.max(fy * srcH - ch / 2, 0), srcH - ch));
    const list = widths.filter((w) => w < cw).concat(Math.min(cw, widths[widths.length - 1]));
    return Array.from(new Set(list))
      .map(
        (w) =>
          `${withParams(
            url,
            `crop=region&crop_left=${left}&crop_top=${top}&crop_width=${cw}&crop_height=${ch}&width=${w}`,
          )} ${w}w`,
      )
      .join(', ');
  }
  const crop = fx < 0.4 ? 'left' : fx > 0.6 ? 'right' : 'center';
  return widths
    .slice(0, 3)
    .map(
      (w) =>
        `${withParams(url, `width=${w}&height=${Math.round(w / ratio)}&crop=${crop}`)} ${w}w`,
    )
    .join(', ');
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(Math.max(n, 0), 1);
}
