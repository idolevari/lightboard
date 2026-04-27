import {data} from 'react-router';
import {uploadImageToShopifyFiles} from '~/lib/shopify-admin';
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
} from '~/lib/photo-canvas';

/**
 * Photo upload endpoint for the PDP photo customizer.
 *
 * Expects a multipart POST with these fields (all optional, presence-based):
 *   cropped_0, cropped_1, cropped_2  — square JPEGs ready for fulfillment
 *   original_0, original_1, original_2 — full-resolution originals (for re-edit)
 *   cartId                            — used as a filename hint for grouping
 *
 * Returns:
 *   { cropped: string[], originals: string[] }   parallel arrays of CDN URLs.
 *
 * On any failure, returns 4xx/5xx with `{error: string}`.
 */

const SLOTS = [0, 1, 2];

export async function action({request, context}) {
  if (request.method !== 'POST') {
    return data({error: 'method-not-allowed'}, {status: 405});
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return data({error: 'invalid-form-data'}, {status: 400});
  }

  const cartId = sanitizeCartId(String(form.get('cartId') ?? ''));

  const croppedFiles = SLOTS.map((i) => form.get(`cropped_${i}`));
  const originalFiles = SLOTS.map((i) => form.get(`original_${i}`));

  for (const file of [...croppedFiles, ...originalFiles]) {
    if (file && !(file instanceof File)) {
      return data({error: 'invalid-field'}, {status: 400});
    }
    if (file instanceof File) {
      if (file.size > MAX_PHOTO_BYTES) {
        return data({error: 'file-too-large'}, {status: 413});
      }
      if (file.type && !ALLOWED_PHOTO_TYPES.includes(file.type)) {
        return data({error: 'unsupported-type'}, {status: 415});
      }
    }
  }

  try {
    const tasks = [];
    SLOTS.forEach((i) => {
      const cropped = croppedFiles[i];
      if (cropped instanceof File) {
        tasks.push(
          uploadImageToShopifyFiles(context.env, {
            blob: cropped,
            filename: photoFilename({
              cartId,
              kind: 'cropped',
              slot: i,
              mimeType: cropped.type,
            }),
            mimeType: cropped.type || 'image/jpeg',
            alt: `Lightboard photo ${i + 1}`,
          }).then((res) => ({kind: 'cropped', slot: i, url: res.url})),
        );
      }
      const original = originalFiles[i];
      if (original instanceof File) {
        tasks.push(
          uploadImageToShopifyFiles(context.env, {
            blob: original,
            filename: photoFilename({
              cartId,
              kind: 'original',
              slot: i,
              mimeType: original.type,
            }),
            mimeType: original.type || 'application/octet-stream',
            alt: `Lightboard original ${i + 1}`,
          }).then((res) => ({kind: 'original', slot: i, url: res.url})),
        );
      }
    });

    const results = await Promise.all(tasks);

    const cropped = SLOTS.map(() => null);
    const originals = SLOTS.map(() => null);
    for (const r of results) {
      if (r.kind === 'cropped') cropped[r.slot] = r.url;
      else originals[r.slot] = r.url;
    }

    return data({cropped, originals});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload-failed';
    return data({error: message}, {status: 502});
  }
}

export async function loader() {
  return data({error: 'method-not-allowed'}, {status: 405});
}

function sanitizeCartId(raw) {
  if (!raw) return 'anon';
  // Cart IDs look like gid://shopify/Cart/abc123. Pull the trailing token.
  const match = raw.match(/[A-Za-z0-9_-]+$/);
  return match ? match[0].slice(0, 32) : 'anon';
}

function photoFilename({cartId, kind, slot, mimeType}) {
  const ext = extensionForMimeType(mimeType);
  const stamp = Date.now();
  return `lightboard-${kind}-${cartId}-${slot + 1}-${stamp}.${ext}`;
}

function extensionForMimeType(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}
