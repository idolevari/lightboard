import {PHOTOS, SHOPIFY_FILES_CDN} from '~/lib/photos';

export type HeroSlideForRender = {
  id?: string;
  img: string;
  label?: string;
  /** Source pixel size — lets us request exact CDN crops (no upscaling). */
  w?: number;
  h?: number;
  /** Desktop object-position, e.g. "50% 60%". */
  deskPos?: string;
  /** Horizontal focal point for the portrait phone crop, e.g. "30%". */
  mobilePos?: string;
  /** Optional dedicated portrait photo for phones. */
  mobile?: {img: string; w: number; h: number; pos?: string};
};

const CDN = SHOPIFY_FILES_CDN;

/**
 * Fallback hero rotation, used while no `hero_slide` metaobjects exist
 * (Shopify Admin → Content → Metaobjects wins as soon as entries are added).
 * Warm/cool alternating, ending warm. Photo sources + licences: see
 * `PHOTOS` in app/lib/photos.ts (all Shopify Files, Unsplash License).
 */
export const HERO_SLIDES: Array<HeroSlideForRender> = [
  {
    // lightboard-01-van-surfboard-sunset.jpg · Jon Matthews · Unsplash License
    img: PHOTOS.vanSunset.url,
    w: PHOTOS.vanSunset.w,
    h: PHOTOS.vanSunset.h,
    label: 'COAST · LAST LIGHT',
    deskPos: '50% 60%',
    // The bus spans ~60% of the frame, so a 9:16 crop would slice it.
    // Phones get the native-portrait van-bed frame instead
    // (lightboard-03-van-bed-ocean-view.jpg · Jeremy Bishop · Unsplash License).
    mobile: {
      img: PHOTOS.vanBed.url,
      w: PHOTOS.vanBed.w,
      h: PHOTOS.vanBed.h,
      pos: '55%',
    },
  },
  {
    img: `${CDN}/tim-marshall-hIHh4E4_OGA-unsplash.jpg?v=1777138490`,
    w: 3600,
    h: 2400,
    label: 'SURF · OFFSHORE',
  },
  {
    // lightboard-02-golden-hour-wave.jpg · Linus Nylund · Unsplash License
    img: PHOTOS.goldenWave.url,
    w: PHOTOS.goldenWave.w,
    h: PHOTOS.goldenWave.h,
    label: 'SURF · GOLDEN HOUR',
    deskPos: '50% 55%',
    mobilePos: '62%',
  },
  {
    img: `${CDN}/mikail-mcverry-6WRjFofNhPs-unsplash.jpg?v=1777136172`,
    w: 4822,
    h: 3215,
    label: 'VAN LIFE · BEACH PARK',
    mobilePos: '30%',
  },
  {
    // lightboard-04-van-bluff-sunset.jpg · Daniel J. Schwarz · Unsplash License
    img: PHOTOS.vanBluff.url,
    w: PHOTOS.vanBluff.w,
    h: PHOTOS.vanBluff.h,
    label: 'VAN LIFE · CLIFF TOP',
    deskPos: '50% 70%',
    mobilePos: '45%',
  },
];
