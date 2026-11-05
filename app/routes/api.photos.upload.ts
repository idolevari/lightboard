import {data} from 'react-router';
import {uploadImageToShopifyFiles} from '~/lib/.server/shopify-admin.server';
import {ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES} from '~/lib/photo-canvas';
import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {
  guardPhotoUpload,
  stripJpegLocationMetadata,
} from '~/lib/.server/photo-upload.server';
import type {Route} from './+types/api.photos.upload';

/**
 * Photo upload endpoint for the PDP photo customizer.
 *
 * Expects a multipart POST with these fields (all optional, presence-based):
 *   cropped_0, cropped_1, cropped_2  — square JPEGs ready for fulfillment
 *   original_0, original_1, original_2 — full-resolution originals (for re-edit)
 *   cartId                            — ignored (kept for client compat)
 *
 * Returns:
 *   { cropped: string[], originals: string[] }   parallel arrays of CDN URLs.
 *
 * On any failure, returns 4xx/5xx with a short, fixed `{error: string}` code.
 * Internal details (Admin API errors, file GIDs) are only logged server-side.
 *
 * Abuse controls (same-origin, signed session grant from the PDP, per-session
 * and per-IP rate limits, Content-Length cap) live in photo-upload.server.ts.
 * JPEG uploads have GPS/XMP metadata stripped before reaching the public CDN.
 */

type UploadKind = 'cropped' | 'original';

type UploadResultPart = {
  kind: UploadKind;
  slot: number;
  url: string;
};

const SLOTS = [0, 1, 2] as const;

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data({error: 'method-not-allowed'}, {status: 405});
  }
  if (isLaunchGateActive(request, context.env)) {
    return data({error: 'not-found'}, {status: 404});
  }

  const denied = await guardPhotoUpload(request, context.session);
  if (denied) {
    return data({error: denied.error}, {status: denied.status});
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return data({error: 'invalid-form-data'}, {status: 400});
  }

  const croppedFiles = SLOTS.map((i) => form.get(`cropped_${i}`));
  const originalFiles = SLOTS.map((i) => form.get(`original_${i}`));

  const detectedTypes = new Map<File, DetectedImageType>();
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
      const detected = await detectImageType(file);
      if (!detected) {
        return data({error: 'unsupported-content'}, {status: 415});
      }
      if (file.type && detected !== file.type) {
        return data({error: 'content-type-mismatch'}, {status: 415});
      }
      detectedTypes.set(file, detected);
    }
  }
  if (detectedTypes.size === 0) {
    return data({error: 'no-files'}, {status: 400});
  }

  try {
    const tasks: Promise<UploadResultPart>[] = [];
    const queue = (kind: UploadKind, slot: number, file: File) => {
      const mimeType = detectedTypes.get(file) ?? 'image/jpeg';
      tasks.push(
        prepareUpload(file, mimeType)
          .then((blob) =>
            uploadImageToShopifyFiles(context.env, {
              blob,
              filename: photoFilename(kind, mimeType),
              mimeType,
              alt:
                kind === 'cropped'
                  ? `Lightboard photo ${slot + 1}`
                  : `Lightboard original ${slot + 1}`,
            }),
          )
          .then((res): UploadResultPart => ({kind, slot, url: res.url})),
      );
    };
    SLOTS.forEach((i) => {
      const cropped = croppedFiles[i];
      if (cropped instanceof File) queue('cropped', i, cropped);
      const original = originalFiles[i];
      if (original instanceof File) queue('original', i, original);
    });

    const results = await Promise.all(tasks);

    const cropped: Array<string | null> = SLOTS.map(() => null);
    const originals: Array<string | null> = SLOTS.map(() => null);
    for (const r of results) {
      if (r.kind === 'cropped') cropped[r.slot] = r.url;
      else originals[r.slot] = r.url;
    }

    return data({cropped, originals});
  } catch (err) {
    // Details (Admin API userErrors, file GIDs) stay in server logs only.
    console.error('[photo-upload] upload failed', err);
    return data({error: 'upload-failed'}, {status: 502});
  }
}

/** JPEGs get GPS/XMP stripped; other types are forwarded as-is. */
async function prepareUpload(file: File, mimeType: string): Promise<Blob> {
  if (mimeType !== 'image/jpeg') return file;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return new Blob([stripJpegLocationMetadata(bytes)], {type: mimeType});
}

export async function loader() {
  return data({error: 'method-not-allowed'}, {status: 405});
}

/**
 * Random, unguessable filename. Never derived from the cart (its key is a
 * secret) or from a timestamp alone (enumerable on the public CDN).
 */
function photoFilename(kind: UploadKind, mimeType: string): string {
  return `lightboard-${kind}-${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: string): string {
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

/**
 * Sniff the first bytes of an uploaded file to confirm it actually is an
 * image of an allowed type. The buyer-provided `Content-Type` header is
 * trivially spoofed in a multipart body, so we never trust it alone before
 * forwarding the bytes to Shopify Files.
 *
 * Returns one of 'image/jpeg' | 'image/png' | 'image/webp', or null if the
 * bytes don't match a supported signature.
 */
type DetectedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

async function detectImageType(file: File): Promise<DetectedImageType | null> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    return null;
  }
  if (head.length < 4) return null;
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return 'image/png';
  }
  // WebP: 'RIFF' .... 'WEBP'
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
