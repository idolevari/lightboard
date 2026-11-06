/**
 * Ready-made Printboard designs ("העיצובים שלנו").
 *
 * A preset is a photo that already lives on the Shopify Files CDN, so picking
 * one never uploads anything. The print file is the CDN's own region crop
 * of the original (`crop=region&crop_left=…`), so re-framing a preset in the
 * crop dialog is free too.
 *
 * TO REPLACE OR ADD A DESIGN (owner):
 *   1. Upload the original print file in Shopify Admin → Content → Files.
 *   2. Copy its CDN URL and its pixel width / height into an entry below
 *      (`id` is a stable slug that goes on the order as "Design ID").
 *   3. Add the display name under `printboard.presets.<id>` in
 *      app/lib/i18n/he.json and en.json.
 *   `focalX` / `focalY` (0–1) pick the default framing of the tall 2:5 crop.
 *
 * Today these are the licensed brand photos from `~/lib/photos`.
 */
import {PHOTOS, withParams} from '~/lib/photos';
import type {CropPixels} from '~/lib/photo-canvas';
import {getDefaultCrop} from '~/lib/photo-canvas';
import {PRINTBOARD_ASPECT} from '~/lib/customizer-config';

export type PrintPreset = {
  id: string;
  /** Shopify Files CDN URL of the full-resolution original. */
  url: string;
  width: number;
  height: number;
  focalX?: number;
  focalY?: number;
};

export const PRINTBOARD_PRESETS: ReadonlyArray<PrintPreset> = [
  {id: 'golden-wave', ...photo(PHOTOS.goldenWave), focalX: 0.62},
  {id: 'surfer-dusk', ...photo(PHOTOS.surferDusk), focalX: 0.5},
  {id: 'surfer-walk', ...photo(PHOTOS.surferWalk), focalX: 0.48},
  {id: 'van-bluff', ...photo(PHOTOS.vanBluff), focalX: 0.52},
  {id: 'camper-cliff', ...photo(PHOTOS.camperCliff), focalX: 0.47},
];

function photo(p: {url: string; w: number; h: number}) {
  return {url: p.url, width: p.w, height: p.h};
}

export function findPreset(id: string | null | undefined): PrintPreset | null {
  if (!id) return null;
  return PRINTBOARD_PRESETS.find((p) => p.id === id) ?? null;
}

/** Default 2:5 framing of a preset, around its focal point. */
export function presetDefaultCrop(preset: PrintPreset): CropPixels {
  return getDefaultCrop(preset, PRINTBOARD_ASPECT, {
    x: preset.focalX,
    y: preset.focalY,
  });
}

/**
 * Print-ready URL for a preset: the CDN's region crop of the original at
 * full source resolution (e.g. 960×2400 from a 1600×2400 photo).
 */
export function presetPrintUrl(preset: PrintPreset, crop?: CropPixels | null) {
  const c = crop ?? presetDefaultCrop(preset);
  return withParams(
    preset.url,
    `crop=region&crop_left=${Math.round(c.x)}&crop_top=${Math.round(c.y)}&crop_width=${Math.round(c.width)}&crop_height=${Math.round(c.height)}`,
  );
}

/** Small preview of the source (for tiles and the board preview). */
export function presetPreviewUrl(preset: PrintPreset, width = 900) {
  return withParams(preset.url, `width=${width}`);
}
