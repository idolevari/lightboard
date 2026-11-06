/**
 * Browser-only helpers for the photo customizer:
 *   - validating uploads
 *   - reading dimensions
 *   - rendering a crop rectangle to a JPEG blob via canvas.
 *
 * Everything here assumes a DOM (window, Image, document.createElement).
 */

export const ALLOWED_PHOTO_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const HEIC_TYPES: ReadonlyArray<string> = ['image/heic', 'image/heif'];

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB
/**
 * Photo size thresholds (short side, px).
 *
 * The print is a small square on the board (a few cm per side) and every
 * crop is re-rendered to CROPPED_OUTPUT_SIZE. 800px over a ~6 cm print is
 * ~340 dpi, comfortably above the ~300 dpi photo-print rule of thumb, so it
 * is a safe hard floor. The old 1200px floor rejected Instagram saves
 * (1080px) and most WhatsApp-forwarded photos for no visible print gain.
 * Between MIN and RECOMMENDED we accept the photo but show a soft warning.
 */
export const MIN_PHOTO_DIMENSION = 800;
export const RECOMMENDED_PHOTO_DIMENSION = 1200;
export const CROPPED_OUTPUT_SIZE = 1200;
export const CROPPED_OUTPUT_QUALITY = 0.9;

export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ValidationResult = {
  ok: boolean;
  /** i18n key under photoCustomizer.errors */
  reason?: string;
  /** Accepted, but below the recommended print size. */
  lowRes?: boolean;
};

export type LoadedImage = {
  image: HTMLImageElement;
  objectUrl: string;
  width: number;
  height: number;
};

/**
 * Validate file type and size. Dimensions are checked separately after the
 * image loads, since they need an HTMLImageElement.
 */
export function validatePhotoFile(file: File | null | undefined): ValidationResult {
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
 */
export function validatePhotoDimensions(
  {
    width,
    height,
  }: {
    width: number;
    height: number;
  },
  recommended: number = RECOMMENDED_PHOTO_DIMENSION,
): ValidationResult {
  const shortSide = Math.min(width, height);
  if (shortSide < MIN_PHOTO_DIMENSION) {
    return {ok: false, reason: 'tooSmall'};
  }
  return {ok: true, lowRes: shortSide < recommended};
}

/**
 * Load a File into an HTMLImageElement so we can read dimensions and draw it
 * to a canvas. Caller is responsible for revoking the returned objectUrl when
 * done with the image (e.g. on component unmount or when replacing the file).
 */
export function loadImageFromFile(
  fileOrBlob: File | Blob,
): Promise<LoadedImage> {
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
 * Largest crop of the given aspect (width / height) that fits the image,
 * centered on a focal point (0–1 fractions, default the middle).
 */
export function getDefaultCrop(
  {width, height}: {width: number; height: number},
  aspect: number,
  focal: {x?: number; y?: number} = {},
): CropPixels {
  let cw = width;
  let ch = Math.round(width / aspect);
  if (ch > height) {
    ch = height;
    cw = Math.round(height * aspect);
  }
  const fx = focal.x ?? 0.5;
  const fy = focal.y ?? 0.5;
  const x = Math.round(Math.min(Math.max(fx * width - cw / 2, 0), width - cw));
  const y = Math.round(Math.min(Math.max(fy * height - ch / 2, 0), height - ch));
  return {x, y, width: cw, height: ch};
}

/** Output size of a rendered crop: a square side, or an explicit box. */
export type OutputSize = number | {width: number; height: number};

function outputBox(size: OutputSize): {width: number; height: number} {
  return typeof size === 'number' ? {width: size, height: size} : size;
}

/**
 * Draw the crop rectangle of an image to a canvas (square, or the given
 * box), then export to a JPEG Blob.
 */
export function renderCropToJpegBlob(
  image: HTMLImageElement,
  crop: CropPixels,
  outputSize: OutputSize = CROPPED_OUTPUT_SIZE,
  quality: number = CROPPED_OUTPUT_QUALITY,
): Promise<Blob> {
  const box = outputBox(outputSize);
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = box.width;
    canvas.height = box.height;
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
      box.width,
      box.height,
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
 * Render a print file and keep it under the upload cap: large boxes (the
 * 2000×5000 Printboard file) re-encode at lower quality until they fit.
 */
export async function renderCropUnderCap(
  image: HTMLImageElement,
  crop: CropPixels,
  outputSize: OutputSize,
  quality: number = CROPPED_OUTPUT_QUALITY,
  maxBytes: number = MAX_PHOTO_BYTES,
): Promise<Blob> {
  let q = quality;
  let blob = await renderCropToJpegBlob(image, crop, outputSize, q);
  while (blob.size > maxBytes && q > 0.5) {
    q -= 0.1;
    blob = await renderCropToJpegBlob(image, crop, outputSize, q);
  }
  return blob;
}

const TRUSTED_REMOTE_HOST = 'https://cdn.shopify.com/';

/**
 * Fetch a remote image (e.g. an existing Shopify CDN URL during edit-from-cart)
 * into a Blob so it can be re-cropped without re-uploading the original.
 * Restricted to Shopify CDN — the URL can come from localStorage or cart
 * attributes, both of which are buyer-mutable.
 */
export async function fetchRemoteImageAsBlob(url: string): Promise<Blob> {
  if (typeof url !== 'string' || !url.startsWith(TRUSTED_REMOTE_HOST)) {
    throw new Error('untrusted-image-host');
  }
  const response = await fetch(url, {credentials: 'omit', mode: 'cors'});
  if (!response.ok) {
    throw new Error(`failed-to-fetch-${response.status}`);
  }
  return response.blob();
}
