/**
 * Abuse controls for POST /api/photos/upload.
 *
 * The upload endpoint writes into the merchant's Shopify Files (public CDN)
 * with the Admin token, so it must only serve real shoppers on our own site:
 *
 *   1. Same-origin only (Sec-Fetch-Site / Origin) — blocks cross-site
 *      form/fetch CSRF and casual hot-linking of the endpoint.
 *   2. A signed-session "upload grant" issued when a photo product page is
 *      rendered (grantPhotoUploads, called from the PDP loader). The session
 *      cookie is HMAC-signed with SESSION_SECRET, so it can't be forged; a bare
 *      curl without first loading a product page gets 403.
 *   3. Rate limits: per session (stored in the signed session) and per IP
 *      (Cache API counter — Oxygen has no KV; the Cache API is per data
 *      center and best-effort, which is fine for a cheap throttle).
 *   4. A Content-Length cap checked BEFORE the multipart body is parsed.
 *
 * None of this stops a determined attacker who scripts a browser; for that,
 * add Cloudflare Turnstile on "Approve". It does stop drive-by abuse,
 * CSRF, and bulk scripted uploads from one machine.
 */
import {MAX_PHOTO_BYTES} from '~/lib/photo-canvas';
import type {HydrogenSession} from '@shopify/hydrogen';

const GRANT_KEY = 'photoUploadGrant';
const SESSION_COUNT_KEY = 'photoUploadCount';
const GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // long-lived tabs keep working
/** Refresh the grant at most this often, so PDP responses rarely Set-Cookie. */
const GRANT_REFRESH_MS = 6 * 60 * 60 * 1000;

const WINDOW_MS = 60 * 60 * 1000;
export const MAX_UPLOADS_PER_SESSION_PER_HOUR = 10;
export const MAX_UPLOADS_PER_IP_PER_HOUR = 30;

/** 3 cropped + 3 originals, plus multipart overhead. */
export const MAX_FILES_PER_REQUEST = 6;
export const MAX_UPLOAD_REQUEST_BYTES =
  MAX_FILES_PER_REQUEST * MAX_PHOTO_BYTES + 256 * 1024;

type Grant = {iat: number};
type Counter = {n: number; start: number};

/** Call from the PDP loader when the product takes customer photos. */
export function grantPhotoUploads(session: HydrogenSession): void {
  const grant = session.get(GRANT_KEY) as Grant | undefined;
  const now = Date.now();
  if (grant && now - grant.iat < GRANT_REFRESH_MS) return;
  session.set(GRANT_KEY, {iat: now} satisfies Grant);
}

export type UploadGuardFailure = {status: number; error: string};

export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';
  // Older browsers without Fetch Metadata still send Origin on POST.
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

/**
 * Runs every check that doesn't need the request body. Returns a failure to
 * send back, or null when the upload may proceed (and records it against the
 * session/IP budgets).
 */
export async function guardPhotoUpload(
  request: Request,
  session: HydrogenSession,
): Promise<UploadGuardFailure | null> {
  if (!isSameOriginRequest(request)) {
    return {status: 403, error: 'forbidden'};
  }

  const grant = session.get(GRANT_KEY) as Grant | undefined;
  if (!grant || Date.now() - grant.iat > GRANT_TTL_MS) {
    return {status: 403, error: 'forbidden'};
  }

  const lengthHeader = request.headers.get('content-length');
  const length = lengthHeader ? Number(lengthHeader) : NaN;
  if (!Number.isFinite(length) || length <= 0) {
    return {status: 411, error: 'length-required'};
  }
  if (length > MAX_UPLOAD_REQUEST_BYTES) {
    return {status: 413, error: 'request-too-large'};
  }

  // Per-session budget (signed cookie, so it can't be reset by editing it —
  // only by getting a fresh session, which the per-IP budget then covers).
  const now = Date.now();
  const prev = session.get(SESSION_COUNT_KEY) as Counter | undefined;
  const counter: Counter =
    prev && now - prev.start < WINDOW_MS ? prev : {n: 0, start: now};
  if (counter.n >= MAX_UPLOADS_PER_SESSION_PER_HOUR) {
    return {status: 429, error: 'rate-limited'};
  }

  if (!(await takeIpBudget(request))) {
    return {status: 429, error: 'rate-limited'};
  }

  session.set(SESSION_COUNT_KEY, {n: counter.n + 1, start: counter.start});
  return null;
}

function buyerIp(request: Request): string | null {
  return (
    request.headers.get('oxygen-buyer-ip') ??
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

/**
 * Best-effort per-IP counter in the worker Cache API. Fails open on cache
 * errors (the session budget still applies) so a cache hiccup never blocks
 * real buyers.
 */
async function takeIpBudget(request: Request): Promise<boolean> {
  const ip = buyerIp(request);
  if (!ip) return true;
  try {
    const cache = await caches.open('lb-rate-limit');
    const key = new Request(
      `https://rate-limit.internal/photo-upload/${encodeURIComponent(ip)}`,
    );
    const now = Date.now();
    const hit = await cache.match(key);
    let counter: Counter = {n: 0, start: now};
    if (hit) {
      const stored = (await hit.json()) as Counter;
      if (now - stored.start < WINDOW_MS) counter = stored;
    }
    if (counter.n >= MAX_UPLOADS_PER_IP_PER_HOUR) return false;
    const next: Counter = {n: counter.n + 1, start: counter.start};
    const ttl = Math.max(
      1,
      Math.ceil((counter.start + WINDOW_MS - now) / 1000),
    );
    await cache.put(
      key,
      new Response(JSON.stringify(next), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      }),
    );
    return true;
  } catch (error) {
    console.error('[photo-upload] rate-limit cache unavailable', error);
    return true;
  }
}

/**
 * Remove location/identity metadata from a JPEG before it goes to the public
 * CDN, without re-encoding:
 *   - every XMP APP1 segment is dropped (may carry GPS + device/owner info);
 *   - in the EXIF APP1 segment, the GPS IFD is zeroed in place (entries and
 *     the values they point at) and the GPSInfo pointer is neutralised.
 * Everything else, notably the Orientation tag the re-crop UI relies on, is
 * kept. If the EXIF block can't be parsed safely, the whole EXIF segment is
 * dropped instead (privacy over orientation).
 *
 * Cropped images are rendered through <canvas> in the browser
 * (renderCropToJpegBlob), which already strips all metadata; this pass
 * matters for the full-resolution originals.
 */
export function stripJpegLocationMetadata(
  input: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return input;
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let pos = 2;
  while (pos + 4 <= input.length) {
    if (input[pos] !== 0xff) break;
    const marker = input[pos + 1];
    // Start of scan / end of image: copy the rest verbatim.
    if (marker === 0xda || marker === 0xd9) break;
    // Standalone markers without a length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(input.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    const segLen = (input[pos + 2] << 8) | input[pos + 3];
    const end = pos + 2 + segLen;
    if (segLen < 2 || end > input.length) break;
    const segment = input.subarray(pos, end);
    if (marker === 0xe1) {
      const payload = segment.subarray(4);
      if (startsWithAscii(payload, 'Exif\0\0')) {
        const copy = segment.slice();
        if (scrubExifGps(copy.subarray(4 + 6))) out.push(copy);
        // else: unparseable EXIF -> drop the whole segment
      }
      // XMP (or any other APP1) -> dropped
    } else {
      out.push(segment);
    }
    pos = end;
  }
  out.push(input.subarray(pos));
  const total = out.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of out) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function startsWithAscii(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

const TIFF_TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
};
const GPS_INFO_TAG = 0x8825;

/**
 * Zero the GPS IFD inside a TIFF block (mutates `tiff`). Returns false if the
 * structure is malformed.
 */
function scrubExifGps(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return false;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  const inRange = (o: number, n: number) => o >= 0 && o + n <= tiff.length;

  const ifd0 = u32(4);
  if (!inRange(ifd0, 2)) return false;
  const count = u16(ifd0);
  if (!inRange(ifd0 + 2, count * 12)) return false;

  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) !== GPS_INFO_TAG) continue;
    const gpsIfd = u32(entry + 8);
    if (!inRange(gpsIfd, 2)) return false;
    const gpsCount = u16(gpsIfd);
    if (!inRange(gpsIfd + 2, gpsCount * 12)) return false;
    for (let j = 0; j < gpsCount; j++) {
      const g = gpsIfd + 2 + j * 12;
      const size = (TIFF_TYPE_SIZES[u16(g + 2)] ?? 1) * u32(g + 4);
      if (size > 4) {
        const valueOffset = u32(g + 8);
        if (inRange(valueOffset, size))
          tiff.fill(0, valueOffset, valueOffset + size);
      }
    }
    // Wipe the GPS IFD entries (count stays readable as 0).
    tiff.fill(0, gpsIfd, gpsIfd + 2 + gpsCount * 12);
  }
  return true;
}
