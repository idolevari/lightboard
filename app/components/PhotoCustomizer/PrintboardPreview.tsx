import {useId} from 'react';
import type {ReactNode} from 'react';
import type {CropPixels} from '~/lib/photo-canvas';

import {BOARD_PATH, BOARD_VIEWBOX} from '~/lib/board-outline';

export {BOARD_PATH, BOARD_VIEWBOX};

export type BoardPhoto = {
  src: string;
  /** Natural size of `src`'s source image, needed when `crop` is given. */
  width?: number;
  height?: number;
  /** Crop rect in the source's pixel space. Omit to fill (center crop). */
  crop?: CropPixels | null;
};

function safeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** SVG <image> placed so the crop rect exactly fills the 200×500 board. */
function BoardImage({photo}: {photo: BoardPhoto}) {
  const {width: W, height: H} = BOARD_VIEWBOX;
  const {crop, width, height} = photo;
  if (crop && width && height && crop.width > 0 && crop.height > 0) {
    const sx = W / crop.width;
    const sy = H / crop.height;
    return (
      <image
        href={photo.src}
        x={-crop.x * sx}
        y={-crop.y * sy}
        width={width * sx}
        height={height * sy}
        preserveAspectRatio="none"
      />
    );
  }
  return (
    <image
      href={photo.src}
      x={0}
      y={0}
      width={W}
      height={H}
      preserveAspectRatio="xMidYMid slice"
    />
  );
}

type PrintboardPreviewProps = {
  photo: BoardPhoto | null;
  /** Accessible name of the preview image. */
  label: string;
  /** Shown on the bare board before a design is chosen. */
  emptyHint?: string;
  /** Wall backdrop + shadow (PDP), or just the board (crop dialog). */
  wall?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * Live Printboard preview: the chosen photo clipped to the board outline,
 * with a faint wood grain multiplied through the print, a soft cylindrical
 * sheen, the pale plywood edge and a drop shadow on a light wall. Pure
 * SVG/CSS (no texture images), so it re-renders instantly on every crop.
 */
export function PrintboardPreview({
  photo,
  label,
  emptyHint,
  wall = true,
  className = '',
  children,
}: PrintboardPreviewProps) {
  const id = safeId(useId());
  const clip = `pb-clip-${id}`;
  const grain = `pb-grain-${id}`;
  const sheen = `pb-sheen-${id}`;
  const {width: W, height: H} = BOARD_VIEWBOX;

  const board = (
    <svg
      className="pb-board"
      viewBox={`-8 -6 ${W + 16} ${H + 12}`}
      style={{aspectRatio: `${W + 16} / ${H + 12}`}}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BOARD_PATH} />
        </clipPath>
        {/* Long, vertical grain streaks: high x / very low y frequency. */}
        <filter
          id={grain}
          x="0"
          y="0"
          width={W}
          height={H}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.22 0.012"
            numOctaves="4"
            seed="11"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.13  1.9 0 0 0 -0.72"
          />
        </filter>
        <linearGradient id={sheen} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2410" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={W} height={H} fill="#dcc29a" />
        {photo ? <BoardImage photo={photo} /> : null}
        <rect
          width={W}
          height={H}
          filter={`url(#${grain})`}
          className={photo ? 'pb-board__grain' : 'pb-board__grain is-bare'}
        />
        {/* Matte print: lift the blacks a touch, warm it slightly. */}
        <rect width={W} height={H} fill="#f3e3c4" opacity="0.07" />
        <rect width={W} height={H} fill={`url(#${sheen})`} />
      </g>
      {/* Pale sanded plywood edge, then a hairline to seat it on the wall. */}
      <path
        d={BOARD_PATH}
        fill="none"
        stroke="#ecd9b6"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d={BOARD_PATH}
        fill="none"
        stroke="rgba(70,45,20,0.28)"
        strokeWidth="0.7"
        strokeLinejoin="round"
        transform="translate(0.6 0.9)"
      />
    </svg>
  );

  if (!wall) {
    return <div className={`pb-preview is-bare ${className}`}>{board}</div>;
  }

  return (
    <div className={`pb-preview ${className}`}>
      <div className="pb-wall">
        {board}
        {!photo && emptyHint ? (
          <p className="pb-preview__hint" aria-hidden="true">
            {emptyHint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Tiny board-shaped thumbnail (cart line). No filters, so a list of them
 * stays cheap.
 */
export function BoardThumb({
  src,
  label,
  className = '',
  decorative = false,
}: {
  src: string;
  label: string;
  className?: string;
  /** Inside a labelled control: hide from assistive tech. */
  decorative?: boolean;
}) {
  const id = safeId(useId());
  const clip = `pb-thumb-${id}`;
  const {width: W, height: H} = BOARD_VIEWBOX;
  return (
    <svg
      className={`pb-thumb ${className}`}
      viewBox={`-4 -4 ${W + 8} ${H + 8}`}
      style={{aspectRatio: `${W + 8} / ${H + 8}`}}
      {...(decorative
        ? {'aria-hidden': true}
        : {role: 'img', 'aria-label': label})}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BOARD_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={W} height={H} fill="#dcc29a" />
        <image
          href={src}
          width={W}
          height={H}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
      <path d={BOARD_PATH} fill="none" stroke="#ecd9b6" strokeWidth="4" />
    </svg>
  );
}
