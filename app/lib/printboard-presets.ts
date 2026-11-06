/**
 * Ready-made Printboard designs ("העיצובים שלנו").
 *
 * These are the original print files the studio has been printing, uploaded
 * to Shopify Files at 2:5 (581×1431). A preset's print file IS its URL, so
 * picking one never uploads anything. If the shopper re-frames a preset in
 * the crop dialog, the print file becomes the CDN's region crop of it
 * (`crop=region&crop_left=…`), still with no upload.
 *
 * TO ADD OR REPLACE A DESIGN (owner):
 *   1. Upload the print file (2:5, e.g. 20×50 cm) in Shopify Admin →
 *      Content → Files and copy its CDN URL.
 *   2. Add an entry below: a stable `id` (it goes on the order as
 *      "Design ID"), the Hebrew and English names, the URL and the file's
 *      pixel width / height.
 * The list order is the order the shopper sees.
 */
import {withParams} from '~/lib/photos';
import type {CropPixels} from '~/lib/photo-canvas';
import type {Locale} from '~/lib/i18n';

export type PrintPreset = {
  id: string;
  label: {he: string; en: string};
  /** Shopify Files CDN URL of the print-ready file. */
  url: string;
  width: number;
  height: number;
};

const FILES = 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files';

export const PRINTBOARD_PRESETS: ReadonlyArray<PrintPreset> = [
  {
    id: 'beach-surfer',
    label: {he: 'גולש בחוף הדקלים', en: 'Surfer on the palm beach'},
    url: `${FILES}/printboard-design-beach-surfer.jpg?v=1793995353`,
    width: 581,
    height: 1431,
  },
  {
    id: 'palms',
    label: {he: 'עצי דקל', en: 'Palm trees'},
    url: `${FILES}/printboard-design-palms.png?v=1793995352`,
    width: 581,
    height: 1431,
  },
  {
    id: 'surf-session',
    label: {he: 'סשן גלישה', en: 'Surf session'},
    url: `${FILES}/printboard-design-surf-session.jpg?v=1793995352`,
    width: 581,
    height: 1431,
  },
  {
    id: 'sunset-wave',
    label: {he: 'גל בשקיעה', en: 'Sunset wave'},
    url: `${FILES}/printboard-design-sunset-wave.jpg?v=1793995352`,
    width: 581,
    height: 1431,
  },
  {
    id: 'pink-clouds',
    label: {he: 'עננים ורודים', en: 'Pink clouds'},
    url: `${FILES}/printboard-design-pink-clouds.jpg?v=1793995352`,
    width: 581,
    height: 1431,
  },
];

export function findPreset(id: string | null | undefined): PrintPreset | null {
  if (!id) return null;
  return PRINTBOARD_PRESETS.find((p) => p.id === id) ?? null;
}

export function presetLabel(
  preset: PrintPreset | null | undefined,
  locale: Locale | string,
): string {
  if (!preset) return '';
  return locale === 'en' ? preset.label.en || preset.label.he : preset.label.he;
}

/**
 * Print-ready URL for a preset: the file itself, or — when the shopper
 * re-framed it — the CDN's region crop of it at full source resolution.
 */
export function presetPrintUrl(
  preset: PrintPreset,
  crop?: CropPixels | null,
): string {
  if (!crop) return preset.url;
  return withParams(
    preset.url,
    `crop=region&crop_left=${Math.round(crop.x)}&crop_top=${Math.round(crop.y)}&crop_width=${Math.round(crop.width)}&crop_height=${Math.round(crop.height)}`,
  );
}

/** Downsized preview of the source (tiles, board preview). */
export function presetPreviewUrl(preset: PrintPreset, width = 900): string {
  return width >= preset.width
    ? preset.url
    : withParams(preset.url, `width=${width}`);
}
