import {describe, expect, it} from 'vitest';
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_REQUEST_BYTES,
  isSameOriginRequest,
  stripJpegLocationMetadata,
} from '~/lib/.server/photo-upload.server';
import {MAX_PHOTO_BYTES} from '~/lib/photo-canvas';

const URL_ = 'https://lightboard.co.il/api/photos/upload';

function post(headers: Record<string, string>) {
  return new Request(URL_, {method: 'POST', headers});
}

describe('isSameOriginRequest', () => {
  it('trusts Sec-Fetch-Site when the browser sends it', () => {
    expect(isSameOriginRequest(post({'sec-fetch-site': 'same-origin'}))).toBe(
      true,
    );
    expect(isSameOriginRequest(post({'sec-fetch-site': 'cross-site'}))).toBe(
      false,
    );
    // A matching Origin does not rescue a cross-site fetch.
    expect(
      isSameOriginRequest(
        post({
          'sec-fetch-site': 'same-site',
          origin: 'https://lightboard.co.il',
        }),
      ),
    ).toBe(false);
  });

  it('falls back to the Origin header for older browsers', () => {
    expect(
      isSameOriginRequest(post({origin: 'https://lightboard.co.il'})),
    ).toBe(true);
    expect(isSameOriginRequest(post({origin: 'https://evil.example'}))).toBe(
      false,
    );
    expect(isSameOriginRequest(post({}))).toBe(false);
  });
});

describe('upload size caps', () => {
  it('allows six full-size files plus multipart overhead', () => {
    expect(MAX_FILES_PER_REQUEST).toBe(6);
    expect(MAX_UPLOAD_REQUEST_BYTES).toBe(6 * MAX_PHOTO_BYTES + 256 * 1024);
  });
});

/* ---------- JPEG fixtures ---------- */

function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Little-endian EXIF block: IFD0 with one GPSInfo pointer -> GPS IFD with
 *  one RATIONAL[3] latitude entry whose value lives out of line. */
function exifWithGps(): number[] {
  const tiff = new Uint8Array(64);
  const v = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00]); // "II*\0"
  v.setUint32(4, 8, true); // IFD0 at 8
  v.setUint16(8, 1, true); // 1 entry
  v.setUint16(10, 0x8825, true); // GPSInfo
  v.setUint16(12, 4, true); // LONG
  v.setUint32(14, 1, true);
  v.setUint32(18, 26, true); // GPS IFD at 26
  v.setUint16(26, 1, true); // 1 GPS entry
  v.setUint16(28, 0x0002, true); // GPSLatitude
  v.setUint16(30, 5, true); // RATIONAL
  v.setUint32(32, 3, true); // 3 values = 24 bytes, out of line
  v.setUint32(36, 40, true); // at offset 40
  tiff.fill(0xaa, 40, 64); // the "coordinates"
  return [...ascii('Exif\0\0'), ...tiff];
}

function jpeg(...segments: number[][]): Uint8Array<ArrayBuffer> {
  const sos = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...segments.flat(), ...sos]);
}

describe('stripJpegLocationMetadata', () => {
  it('returns non-JPEG input untouched', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]);
    expect(stripJpegLocationMetadata(png)).toBe(png);
  });

  it('drops XMP segments and keeps other segments and the scan data', () => {
    const app0 = segment(0xe0, ascii('JFIF\0'));
    const xmp = segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<gps/>'));
    const out = stripJpegLocationMetadata(jpeg(app0, xmp));
    expect(Array.from(out)).toEqual(Array.from(jpeg(app0)));
  });

  it('zeroes the GPS IFD and its coordinates but keeps the EXIF segment', () => {
    const exif = segment(0xe1, exifWithGps());
    const input = jpeg(exif);
    const out = stripJpegLocationMetadata(input);
    expect(out.length).toBe(input.length);
    // Same SOI + APP1 header, same "Exif\0\0II" prefix.
    expect(Array.from(out.subarray(0, 16))).toEqual(
      Array.from(input.subarray(0, 16)),
    );
    expect(out.includes(0xaa)).toBe(false);
    // The input buffer is not mutated.
    expect(input.includes(0xaa)).toBe(true);
  });

  it('drops an EXIF segment it cannot parse', () => {
    const broken = segment(0xe1, [...ascii('Exif\0\0'), 0x00, 0x00]);
    const out = stripJpegLocationMetadata(jpeg(broken));
    expect(Array.from(out)).toEqual(Array.from(jpeg()));
  });
});
