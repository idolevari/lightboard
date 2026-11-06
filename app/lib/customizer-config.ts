/**
 * Per-product settings for the PDP photo customizer.
 *
 * One customizer component serves both products:
 *   - Lightboard (`requires-photos` tag): three square photos placed on the
 *     lit board, cropped to 1200×1200.
 *   - Printboard (`requires-print-photo` tag): one photo printed full-bleed
 *     on the wooden fish board, cropped to the board's bounding box
 *     (BOARD_ASPECT ≈ 0.3254) and rendered as a 2000 px wide print file.
 */
import {REQUIRES_PHOTOS_TAG, REQUIRES_PRINT_PHOTO_TAG} from '~/lib/brand-facts';
import {CROPPED_OUTPUT_SIZE} from '~/lib/photo-canvas';
import {BOARD_ASPECT} from '~/lib/board-outline';
import type {OutputSize} from '~/lib/photo-canvas';

export type CustomizerKind = 'lightboard' | 'printboard';

export type CustomizerConfig = {
  kind: CustomizerKind;
  slotCount: number;
  /** Crop aspect, width / height. */
  aspect: number;
  /** Size of the file sent to print. */
  output: OutputSize;
  outputQuality: number;
  /** Local preview render (never uploaded). */
  thumbnail: OutputSize;
  /**
   * Below this many pixels on the print's long edge (the largest crop of
   * this aspect the photo allows) the photo is accepted with a warning.
   */
  recommendedPrintEdge: number;
};

/** Board size shown in copy (specs). Owner to confirm the exact size. */
export const PRINTBOARD_SIZE_CM = {width: 20, height: 50} as const;
export const PRINTBOARD_SIZE_LABEL = `${PRINTBOARD_SIZE_CM.width}×${PRINTBOARD_SIZE_CM.height}`;

/** Print area = the outline's bounding box (see ~/lib/board-outline). */
export const PRINTBOARD_ASPECT = BOARD_ASPECT;
/** Print file: 2000 px wide at the board aspect (2000×6147). */
export const PRINTBOARD_OUTPUT = {
  width: 2000,
  height: Math.round(2000 / BOARD_ASPECT),
} as const;

export const CUSTOMIZER_CONFIG: Record<CustomizerKind, CustomizerConfig> = {
  lightboard: {
    kind: 'lightboard',
    slotCount: 3,
    aspect: 1,
    output: CROPPED_OUTPUT_SIZE,
    outputQuality: 0.9,
    thumbnail: 480,
    recommendedPrintEdge: 1200,
  },
  printboard: {
    kind: 'printboard',
    slotCount: 1,
    aspect: PRINTBOARD_ASPECT,
    output: PRINTBOARD_OUTPUT,
    outputQuality: 0.88,
    thumbnail: {width: 480, height: 1200},
    // ~120 dpi over 50 cm: sharp at viewing distance on the wall.
    recommendedPrintEdge: 2400,
  },
};

/** Which customizer (if any) a product uses, from its Shopify tags. */
export function customizerKindForTags(
  tags: ReadonlyArray<string> | null | undefined,
): CustomizerKind | null {
  if (!tags) return null;
  if (tags.includes(REQUIRES_PRINT_PHOTO_TAG)) return 'printboard';
  if (tags.includes(REQUIRES_PHOTOS_TAG)) return 'lightboard';
  return null;
}

/** Long edge (px) of the biggest crop of `aspect` that fits the photo. */
export function maxPrintEdge(
  {width, height}: {width: number; height: number},
  aspect: number,
): number {
  // Height-limited when the photo is "taller" than the crop, else width-limited.
  const cropW = Math.min(width, height * aspect);
  const cropH = cropW / aspect;
  return Math.round(Math.max(cropW, cropH));
}

/**
 * Cart line attribute keys. `Photo N` is shared by both products so cart
 * thumbnails and the order admin read one scheme; the rest are Printboard
 * extras the studio needs to print.
 */
export const LINE_ATTR = {
  photo: (n: number) => `Photo ${n}`,
  original: 'Original photo',
  design: 'Design',
  designId: 'Design ID',
} as const;
