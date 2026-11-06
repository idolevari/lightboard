import {describe, expect, it} from 'vitest';
import {BOARD_ASPECT, BOARD_PATH, BOARD_VIEWBOX} from '~/lib/board-outline';
import {
  CUSTOMIZER_CONFIG,
  LINE_ATTR,
  PRINTBOARD_OUTPUT,
  PRINTBOARD_SIZE_LABEL,
  customizerKindForTags,
  maxPrintEdge,
} from '~/lib/customizer-config';
import {CROPPED_OUTPUT_SIZE} from '~/lib/photo-canvas';
import {
  PRINTBOARD_PRESETS,
  findPreset,
  presetLabel,
  presetPreviewUrl,
  presetPrintUrl,
} from '~/lib/printboard-presets';

describe('board outline', () => {
  it('derives the aspect from the viewBox (≈0.3254, taller than wide)', () => {
    expect(BOARD_ASPECT).toBeCloseTo(BOARD_VIEWBOX.width / BOARD_VIEWBOX.height);
    expect(BOARD_ASPECT).toBeCloseTo(0.3254, 4);
  });

  it('is a single closed path whose points stay inside the viewBox', () => {
    expect(BOARD_PATH.startsWith('M')).toBe(true);
    expect(BOARD_PATH.trim().endsWith('Z')).toBe(true);
    expect(BOARD_PATH.match(/M/g)).toHaveLength(1);
    const coords = [...BOARD_PATH.matchAll(/([\d.]+) ([\d.]+)/g)].map(
      ([, x, y]) => [Number(x), Number(y)] as const,
    );
    const xs = coords.map(([x]) => x);
    const ys = coords.map(([, y]) => y);
    // The bounding box of the path is the viewBox (print area).
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(BOARD_VIEWBOX.width);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(BOARD_VIEWBOX.height);
  });
});

describe('customizer config', () => {
  it('Lightboard takes three square photos rendered at the crop output size', () => {
    const c = CUSTOMIZER_CONFIG.lightboard;
    expect(c.slotCount).toBe(3);
    expect(c.aspect).toBe(1);
    expect(c.output).toBe(CROPPED_OUTPUT_SIZE);
  });

  it('Printboard takes one photo at the board aspect, 2000 px wide', () => {
    const c = CUSTOMIZER_CONFIG.printboard;
    expect(c.slotCount).toBe(1);
    expect(c.aspect).toBe(BOARD_ASPECT);
    expect(PRINTBOARD_OUTPUT.width).toBe(2000);
    expect(PRINTBOARD_OUTPUT.width / PRINTBOARD_OUTPUT.height).toBeCloseTo(
      BOARD_ASPECT,
      3,
    );
    expect(PRINTBOARD_SIZE_LABEL).toBe('20×50');
  });

  it('every config kind matches its key and has a sane quality', () => {
    for (const [kind, c] of Object.entries(CUSTOMIZER_CONFIG)) {
      expect(c.kind).toBe(kind);
      expect(c.outputQuality).toBeGreaterThan(0.5);
      expect(c.outputQuality).toBeLessThanOrEqual(1);
    }
  });

  it('picks the customizer from product tags, Printboard winning over Lightboard', () => {
    expect(customizerKindForTags(['requires-photos'])).toBe('lightboard');
    expect(customizerKindForTags(['requires-print-photo'])).toBe('printboard');
    expect(
      customizerKindForTags(['requires-photos', 'requires-print-photo']),
    ).toBe('printboard');
    expect(customizerKindForTags(['gift'])).toBeNull();
    expect(customizerKindForTags(null)).toBeNull();
  });

  it('maxPrintEdge is the long edge of the biggest crop of that aspect', () => {
    // Square crop from a landscape photo: limited by the height.
    expect(maxPrintEdge({width: 4000, height: 3000}, 1)).toBe(3000);
    // Tall Printboard crop from a landscape photo: height-limited too.
    expect(maxPrintEdge({width: 4000, height: 3000}, BOARD_ASPECT)).toBe(3000);
    // Tall Printboard crop from a skinny photo: width-limited.
    expect(maxPrintEdge({width: 500, height: 3000}, BOARD_ASPECT)).toBe(
      Math.round(500 / BOARD_ASPECT),
    );
  });

  it('names cart line attributes Photo 1..n', () => {
    expect(LINE_ATTR.photo(1)).toBe('Photo 1');
    expect(LINE_ATTR.photo(3)).toBe('Photo 3');
  });
});

describe('Printboard presets', () => {
  it('have unique ids, both labels and a Shopify CDN print file', () => {
    const ids = PRINTBOARD_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRINTBOARD_PRESETS) {
      expect(p.label.he).not.toBe('');
      expect(p.label.en).not.toBe('');
      expect(p.url.startsWith('https://cdn.shopify.com/')).toBe(true);
    }
  });

  it('are portrait files at least as wide as the board aspect (cover-fit trims the sides)', () => {
    for (const p of PRINTBOARD_PRESETS) {
      expect(p.height).toBeGreaterThan(p.width);
      expect(p.width / p.height).toBeGreaterThanOrEqual(BOARD_ASPECT);
    }
  });

  it('finds a preset by id, and returns null otherwise', () => {
    expect(findPreset('palms')?.id).toBe('palms');
    expect(findPreset('nope')).toBeNull();
    expect(findPreset(null)).toBeNull();
  });

  it('labels a preset in the active locale', () => {
    const palms = findPreset('palms');
    expect(presetLabel(palms, 'he')).toBe('עצי דקל');
    expect(presetLabel(palms, 'en')).toBe('Palm trees');
    expect(presetLabel(null, 'en')).toBe('');
  });

  it('prints the file itself, or a rounded CDN region crop when re-framed', () => {
    const p = PRINTBOARD_PRESETS[0];
    expect(presetPrintUrl(p)).toBe(p.url);
    const url = presetPrintUrl(p, {x: 10.4, y: 0, width: 470.6, height: 1431});
    // The preset URL already has ?v=, so params are appended with &.
    expect(url).toBe(
      `${p.url}&crop=region&crop_left=10&crop_top=0&crop_width=471&crop_height=1431`,
    );
  });

  it('only asks the CDN to downsize previews smaller than the source', () => {
    const p = PRINTBOARD_PRESETS[0];
    expect(presetPreviewUrl(p, 300)).toBe(`${p.url}&width=300`);
    expect(presetPreviewUrl(p, 900)).toBe(p.url);
  });
});
