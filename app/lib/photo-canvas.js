/**
 * Browser-only helpers for the photo customizer:
 *   - validating uploads
 *   - reading dimensions
 *   - rendering a crop rectangle to a JPEG blob via canvas.
 *
 * Everything here assumes a DOM (window, Image, document.createElement).
 */

export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const HEIC_TYPES = ['image/heic', 'image/heif'];

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MIN_PHOTO_DIMENSION = 1200;
export const CROPPED_OUTPUT_SIZE = 1200;
export const CROPPED_OUTPUT_QUALITY = 0.9;

/**
 * @typedef {Object} CropPixels
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string} [reason]   i18n key under photoCustomizer.errors
 */

/**
 * Validate file type and size. Dimensions are checked separately after the
 * image loads, since they need an HTMLImageElement.
 * @param {File} file
 * @returns {ValidationResult}
 */
export function validatePhotoFile(file) {
  if (!file) return {ok: false, reason: 'noFile'};
  // HEIC/HEIF photos from iPhones can't be decoded in most desktop browsers,
  // so we reject them up-front with a clear message rather than letting the
  // <img> load fail silently.
  const lowerName = (file.name || '').toLowerCase();
  if (
    HEIC_TYPES.includes(file.type) ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
  ) {
    return {ok: false, reason: 'heic'};
  }
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return {ok: false, reason: 'badType'};
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {ok: false, reason: 'tooLarge'};
  }
  return {ok: true};
}

/**
 * Validate already-loaded image dimensions.
 * @param {{width: number, height: number}} dims
 * @returns {ValidationResult}
 */
export function validatePhotoDimensions({width, height}) {
  if (width < MIN_PHOTO_DIMENSION || height < MIN_PHOTO_DIMENSION) {
    return {ok: false, reason: 'tooSmall'};
  }
  return {ok: true};
}

/**
 * Load a File into an HTMLImageElement so we can read dimensions and draw it
 * to a canvas. Caller is responsible for revoking the returned objectUrl when
 * done with the image (e.g. on component unmount or when replacing the file).
 * @param {File | Blob} fileOrBlob
 * @returns {Promise<{image: HTMLImageElement, objectUrl: string, width: number, height: number}>}
 */
export function loadImageFromFile(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const image = new Image();
    image.onload = () => {
      resolve({
        image,
        objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    image.src = objectUrl;
  });
}

/**
 * Default centered square crop in pixel coordinates.
 * @param {{width: number, height: number}} dims
 * @returns {CropPixels}
 */
export function getDefaultSquareCrop({width, height}) {
  const size = Math.min(width, height);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    width: size,
    height: size,
  };
}

/**
 * Draw the crop rectangle of an image to a square canvas, then export to a
 * JPEG Blob at the configured output size.
 * @param {HTMLImageElement} image
 * @param {CropPixels} crop pixel-space crop rectangle on the source image
 * @param {number} [outputSize] edge length of the square output, in px
 * @param {number} [quality] JPEG quality 0..1
 * @returns {Promise<Blob>}
 */
export function renderCropToJpegBlob(
  image,
  crop,
  outputSize = CROPPED_OUTPUT_SIZE,
  quality = CROPPED_OUTPUT_QUALITY,
) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('canvas-2d-unavailable'));
      return;
    }
    // Smooth downscale.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      outputSize,
      outputSize,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('canvas-toblob-failed'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Convenience: read a File, default-crop or use supplied crop, return blob.
 * Frees the intermediate object URL.
 * @param {File} file
 * @param {CropPixels} crop
 * @param {number} [outputSize]
 * @returns {Promise<Blob>}
 */
export async function cropFileToJpegBlob(file, crop, outputSize) {
  const {image, objectUrl} = await loadImageFromFile(file);
  try {
    return await renderCropToJpegBlob(image, crop, outputSize);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Fetch a remote image (e.g. an existing Shopify CDN URL during edit-from-cart)
 * into a Blob so it can be re-cropped without re-uploading the original.
 * @param {string} url
 * @returns {Promise<Blob>}
 */
export async function fetchRemoteImageAsBlob(url) {
  const response = await fetch(url, {credentials: 'omit', mode: 'cors'});
  if (!response.ok) {
    throw new Error(`failed-to-fetch-${response.status}`);
  }
  return response.blob();
}
