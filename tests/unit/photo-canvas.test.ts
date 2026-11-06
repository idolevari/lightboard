import {describe, expect, it} from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MIN_PHOTO_DIMENSION,
  fetchRemoteImageAsBlob,
  getDefaultCrop,
  getDefaultSquareCrop,
  validatePhotoDimensions,
  validatePhotoFile,
} from '~/lib/photo-canvas';
import {
  OPTION_VALUE_HEX,
  getOptionValueHex,
  translateOptionName,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import he from '~/lib/i18n/he.json';
import {BOARD_ASPECT} from '~/lib/board-outline';

/** A File-like stub: validatePhotoFile only reads name, type and size. */
function file(name: string, type: string, size = 1024): File {
  return {name, type, size} as File;
}

describe('validatePhotoFile', () => {
  it('accepts JPEG, PNG and WebP up to 15 MB', () => {
    expect(MAX_PHOTO_BYTES).toBe(15 * 1024 * 1024);
    expect(validatePhotoFile(file('a.jpg', 'image/jpeg'))).toEqual({ok: true});
    expect(validatePhotoFile(file('a.png', 'image/png'))).toEqual({ok: true});
    expect(
      validatePhotoFile(file('a.webp', 'image/webp', MAX_PHOTO_BYTES)),
    ).toEqual({ok: true});
  });

  it('rejects HEIC by MIME type or by extension, before the generic type check', () => {
    expect(validatePhotoFile(file('IMG_1.HEIC', ''))).toEqual({
      ok: false,
      reason: 'heic',
    });
    expect(validatePhotoFile(file('x', 'image/heif')).reason).toBe('heic');
  });

  it('rejects other types, oversized files and a missing file', () => {
    expect(validatePhotoFile(file('a.gif', 'image/gif')).reason).toBe(
      'badType',
    );
    expect(
      validatePhotoFile(file('a.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1))
        .reason,
    ).toBe('tooLarge');
    expect(validatePhotoFile(null).reason).toBe('noFile');
  });
});

describe('validatePhotoDimensions', () => {
  it('rejects photos whose short side is under 800 px', () => {
    expect(MIN_PHOTO_DIMENSION).toBe(800);
    expect(validatePhotoDimensions({width: 4000, height: 799})).toEqual({
      ok: false,
      reason: 'tooSmall',
    });
  });

  it('accepts 800–1199 px with a low-res warning, and 1200+ cleanly', () => {
    expect(validatePhotoDimensions({width: 1080, height: 1080})).toEqual({
      ok: true,
      lowRes: true,
    });
    expect(validatePhotoDimensions({width: 1200, height: 3000})).toEqual({
      ok: true,
      lowRes: false,
    });
  });

  it('takes a custom recommended size', () => {
    expect(
      validatePhotoDimensions({width: 2000, height: 2000}, 2400).lowRes,
    ).toBe(true);
  });
});

describe('default crops', () => {
  it('centres the largest square on a landscape photo', () => {
    expect(getDefaultSquareCrop({width: 4000, height: 3000})).toEqual({
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
    });
  });

  it('fits a tall board-aspect crop inside the photo', () => {
    const crop = getDefaultCrop({width: 3000, height: 4000}, BOARD_ASPECT);
    expect(crop.height).toBe(4000);
    expect(crop.width).toBe(Math.round(4000 * BOARD_ASPECT));
    expect(crop.x + crop.width).toBeLessThanOrEqual(3000);
    expect(crop.y).toBe(0);
  });

  it('moves towards a focal point but never leaves the image', () => {
    const left = getDefaultCrop({width: 4000, height: 3000}, 1, {x: 0});
    expect(left.x).toBe(0);
    const right = getDefaultCrop({width: 4000, height: 3000}, 1, {x: 1});
    expect(right.x).toBe(1000);
    const portrait = getDefaultCrop({width: 3000, height: 4000}, 1, {y: 0.25});
    expect(portrait).toEqual({x: 0, y: 0, width: 3000, height: 3000});
  });
});

describe('fetchRemoteImageAsBlob', () => {
  it('refuses any host other than the Shopify CDN', async () => {
    await expect(
      fetchRemoteImageAsBlob('https://evil.example/cdn.shopify.com/a.jpg'),
    ).rejects.toThrow('untrusted-image-host');
  });
});

describe('product option labels', () => {
  it('translates Shopify option names and values with the dictionary', () => {
    expect(translateOptionValue(he, 'Light Blue')).toBe('תכלת');
    expect(translateOptionName(he, 'Color')).not.toBe('');
  });

  it('falls back to the Shopify string when there is no translation', () => {
    expect(translateOptionValue(he, 'Neon Green')).toBe('Neon Green');
    expect(translateOptionName(null, 'Size')).toBe('Size');
  });

  it('has a hex swatch for each of the three finishes', () => {
    expect(Object.keys(OPTION_VALUE_HEX)).toEqual([
      'Light Blue',
      'Cream',
      'Pink',
    ]);
    for (const hex of Object.values(OPTION_VALUE_HEX)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(getOptionValueHex('Cream')).toBe('#f5ebd8');
    expect(getOptionValueHex('Unknown')).toBeNull();
  });
});
