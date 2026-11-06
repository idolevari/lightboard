/**
 * Printboard silhouette in a 200×500 box (20×50 cm): pointed nose at the
 * top, widest just above the middle, gentle taper, and a fish-tail (swallow)
 * notch between two rounded lobes at the bottom. Traced by eye from the
 * product photos of finished boards (not the owner's 18×60 round-tail DXF,
 * which is a different board).
 *
 * To swap the shape: replace BOARD_PATH with a single closed SVG path
 * drawn in the 0 0 200 500 box. The preview, crop overlay, preset tiles and
 * cart thumbnail all read it from here.
 */
export const BOARD_VIEWBOX = {width: 200, height: 500} as const;
export const BOARD_PATH = [
  'M100 3',
  'C126 30 182 118 194 236',
  'C200 318 192 398 170 452',
  'L156 490',
  'Q152 499 144 494',
  'Q122 478 100 474',
  'Q78 478 56 494',
  'Q48 499 44 490',
  'L30 452',
  'C8 398 0 318 6 236',
  'C18 118 74 30 100 3',
  'Z',
].join(' ');
