/**
 * "Golden Hour Van" illustration kit — hand-drawn SVGs inlined as tiny
 * components so they theme through `currentColor` and CSS custom properties
 * (`--sun`, `--board`, `--bulb`, `--wave-line`, …) and can animate (see the
 * MOTION block in app.css).
 *
 * Every illustration here is decorative: `aria-hidden` + `focusable=false`.
 * Explicit width/height or aspect-ratio boxes keep CLS at 0.
 *
 * Looping animations only run while the wrapper carries `.is-live`
 * (see <LiveLoop/>), and never under prefers-reduced-motion or the
 * accessibility menu's "stop animations" switch.
 */
import {useId} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {useInView} from '~/lib/useInView';

type SvgProps = {className?: string; style?: CSSProperties};

const hidden = {'aria-hidden': true, focusable: false} as const;

/**
 * Wrapper that adds `.is-live` while it is on screen, so the CSS loops
 * inside it (`animation-play-state`) are paused off-screen.
 */
export function LiveLoop({
  as: Tag = 'div',
  className = '',
  children,
  style,
}: {
  as?: 'div' | 'span' | 'section' | 'footer';
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({
    once: false,
    threshold: 0,
    rootMargin: '0px',
  });
  return (
    <Tag
      // The ref type is shared across the small tag union above.
      ref={ref as never}
      className={`${className}${inView ? ' is-live' : ''}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Half sun with the logo's dashed ray arc. Rays rotate (M6). */
export function SunRays({className = '', style}: SvgProps) {
  return (
    <svg
      viewBox="0 0 200 112"
      fill="none"
      className={`sun-rays ${className}`}
      style={style}
      {...hidden}
    >
      <g
        className="sun-rays__rays"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      >
        <path d="M41.8 88.1L19 81.7M43.3 74.3L32.1 68.9M53.5 65.4L35.1 49.5M60.9 53.6L53.3 43.4M74.8 50.2L64.6 27.7M86.7 41L84 29.5M99.6 43.5L99.8 20.4M113.5 41.6L116.6 29.6M125.4 49.1L135 27.5M139.2 53.1L146 43.8M145.9 65.2L164.7 50.2M156.5 74.5L167.4 69.4M158.2 88.2L181.7 81.8" />
      </g>
      <path
        className="sun-rays__disc"
        d="M52 104c1-27 22-48 48.5-48S148 77 149 104z"
        fill="var(--sun, #f6c95b)"
      />
      <path
        d="M40 104.5c40-.8 80 .6 120-.4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Organic wave edge between sections. `color` = the background of the
 * section the wave flows INTO. `flip` turns it upside down (fill on top).
 */
export function WaveDivider({
  className = '',
  flip = false,
  style,
}: SvgProps & {flip?: boolean}) {
  return (
    <svg
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      className={`wave-divider${flip ? ' wave-divider--flip' : ''} ${className}`}
      style={style}
      {...hidden}
    >
      <path
        fill="currentColor"
        d="M0 26q60 -13.5 120 0t120 0q60 -15.5 120 0t120 0q60 -11.9 120 0t120 0q60 -13.9 120 0t120 0q60 -11.2 120 0t120 0q60 -15 120 0t120 0V56H0z"
      />
      <path
        className="wave-divider__line"
        fill="none"
        stroke="var(--wave-line, #27cfdc)"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        d="M0 18q60 -13.6 120 0t120 0q60 -12.4 120 0t120 0q60 -14.3 120 0t120 0q60 -10.9 120 0t120 0q60 -13.2 120 0t120 0q60 -12.6 120 0t120 0"
      />
    </svg>
  );
}

const WL_BACK =
  'q90 -22.9 180 0t180 0q90 -21.5 180 0t180 0q90 -25.7 180 0t180 0q90 -26.9 180 0t180 0';
const WL_MID =
  'q72 -15.8 144 0t144 0q72 -17.3 144 0t144 0q72 -12.5 144 0t144 0q72 -17.6 144 0t144 0q72 -17.2 144 0t144 0';

/**
 * Three translucent wave bands at the hero foot. The back and middle bands
 * are drawn twice (2880 wide) so a translateX(-50%) loop is seamless (M4);
 * the front band equals the next section's background and stays still.
 */
export function WaveLayers({className = ''}: {className?: string}) {
  return (
    <div className={`wave-layers ${className}`} {...hidden}>
      <div className="wl-track wl-track--back">
        <svg viewBox="0 0 2880 160" preserveAspectRatio="none">
          <path
            fill="var(--wl-1, #27cfdc)"
            fillOpacity=".35"
            d={`M0 70${WL_BACK}${WL_BACK}V160H0z`}
          />
        </svg>
      </div>
      <div className="wl-track wl-track--mid">
        <svg viewBox="0 0 2880 160" preserveAspectRatio="none">
          <path
            fill="var(--wl-2, #c9b58d)"
            fillOpacity=".55"
            d={`M0 96${WL_MID}${WL_MID}V160H0z`}
          />
        </svg>
      </div>
      <svg
        className="wl-front"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
      >
        <path
          fill="var(--wl-3, #f4ede0)"
          d="M0 124q60 -15 120 0t120 0q60 -13.9 120 0t120 0q60 -10.7 120 0t120 0q60 -11.3 120 0t120 0q60 -13 120 0t120 0q60 -9.1 120 0t120 0V160H0z"
        />
      </svg>
    </div>
  );
}

const BULBS: Array<[number, number]> = [
  [30, 29],
  [87, 35.9],
  [144, 42.2],
  [201, 46.9],
  [258, 50.8],
  [315, 50.3],
  [372, 48.8],
  [429, 45.1],
  [486, 40.2],
  [543, 32],
];
const CLIPS: Array<[number, number, number]> = [
  [128, 34.1, -6],
  [300, 44, 3],
  [470, 34.4, -4],
];

/** The product in one line: warm bulbs + clipped photos on a sagging wire. */
export function StringLights({className = '', style}: SvgProps) {
  return (
    <svg
      viewBox="0 0 600 110"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`string-lights ${className}`}
      style={style}
      {...hidden}
    >
      <path d="M0 14C120 58 480 58 600 14" />
      <g fill="var(--bulb, #ffbc7d)" strokeWidth="1.4">
        {BULBS.map(([cx, cy], n) => (
          <ellipse
            key={cx}
            className="sl__bulb"
            cx={cx}
            cy={cy}
            rx="6"
            ry="8"
            style={{'--n': n} as CSSProperties}
          />
        ))}
      </g>
      {CLIPS.map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M-3-4h6v10h-6z" fill="var(--clip, #c9b58d)" stroke="none" />
          <rect
            x="-17"
            y="4"
            width="34"
            height="40"
            rx="1.5"
            fill="var(--paper, #fbf8f2)"
          />
          <rect
            x="-13"
            y="8"
            width="26"
            height="24"
            fill="var(--photo, #27cfdc)"
            fillOpacity=".55"
            stroke="none"
          />
        </g>
      ))}
    </svg>
  );
}

/** Lime circular stamp: "LIVING · DESIGN · SURFING · LIGHTBOARD". Ring rotates (M7). */
export function StampBadge({className = '', style}: SvgProps) {
  const pathId = `sb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 160 160"
      className={`stamp-badge ${className}`}
      style={style}
      {...hidden}
    >
      <defs>
        <path
          id={pathId}
          d="M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1-116 0"
        />
      </defs>
      <circle cx="80" cy="80" r="76" fill="var(--badge-bg, #dadb65)" />
      <circle
        cx="80"
        cy="80"
        r="70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 4"
      />
      <g className="stamp-badge__ring">
        <text
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize="12"
          letterSpacing="2"
          fill="currentColor"
          direction="ltr"
        >
          <textPath href={`#${pathId}`} textLength="360" lengthAdjust="spacing">
            LIVING · DESIGN · SURFING · LIGHTBOARD ·
          </textPath>
        </text>
      </g>
      <path d="M62 92a18 18 0 0 1 36 0z" fill="currentColor" />
      <path
        d="M56 92.5h48M80 60v6M66 65l3 4.6M94 65l-3 4.6M57 76l4.6 2.2M103 76l-4.6 2.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 100c6.6-3 13.4-3 20 0s13.4 3 20 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Line-art split-window bus with a board on the roof. Faces reading-start in RTL. */
export function Van({className = '', style}: SvgProps) {
  return (
    <svg
      viewBox="0 0 240 150"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`van-art ${className}`}
      style={style}
      {...hidden}
    >
      <path
        d="M38 28c28-7.5 120-8.5 168-.5 4 .8 4 4.3 0 5-50 6.8-138 6.5-168 .8-3.7-.7-3.7-4.5 0-5.3z"
        fill="var(--board, #dadb65)"
      />
      <path d="M60 30.6c40-1.8 90-1.6 128 .2" strokeWidth="1.6" />
      <path d="M199 33.5l6.5 7.5" />
      <path d="M52 36v8M110 36.5v8M168 36v8M44 44.5h136" />
      <path d="M30.5 116c-3-26-2.6-46 2.5-60 3.3-9 10-12.4 22-12.6 42-.8 88-.7 128 .3 13 .3 20 5 25.5 16 6.6 13.4 10.6 33 10.8 56.2" />
      <path d="M30 116.5c58 1.4 120 1.2 190-.3" />
      <path d="M31.5 86c60 1.5 125 1.3 188-.6" />
      <path d="M44 56.5h28v18H43.5c-.6-7-.6-12.4.5-18zM82 56.5h30v18H82zM122 56.5h30v18h-30zM162 56.5h22c6 0 9.5 3.4 12 9.5l3.2 8.5H162z" />
      <path d="M117 76v40M124 92h7" />
      <path d="M24 110.5c3-.4 6-.4 8 0M218 109.5c3.6-.4 6.4-.3 9 .3" />
      <circle cx="66" cy="118" r="15" fill="var(--paper, #f4ede0)" />
      <circle cx="66" cy="118" r="5.5" />
      <circle cx="182" cy="117.5" r="15" fill="var(--paper, #f4ede0)" />
      <circle cx="182" cy="117.5" r="5.5" />
      <path d="M8 134c70 1.6 150 1.2 226-.8" strokeWidth="2" />
      <path className="van-art__ticks" d="M6 100h12M2 108h10M10 92h8" strokeWidth="2" />
    </svg>
  );
}

/** Upright board with stringer, rail stripes and a sun sticker. */
export function Surfboard({className = '', style}: SvgProps) {
  return (
    <svg
      viewBox="0 0 80 240"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`surfboard-art ${className}`}
      style={style}
      {...hidden}
    >
      <path
        d="M40 6c-15.5 22-24.5 58-25 104-.6 50 7 92 24 126 17.4-34 25.5-76 25-126C63.5 64 55 28 40 6z"
        fill="var(--board, #ebe2d2)"
      />
      <path d="M40 12c.6 70 .5 150-.6 218" strokeWidth="1.6" />
      <path
        d="M19 150c14 3 28 3 42 0M18.5 158c14.6 3 29 3 43 0"
        stroke="var(--stripe, #27cfdc)"
        strokeWidth="3.5"
      />
      <circle cx="40" cy="70" r="7" fill="var(--sun, #f6c95b)" strokeWidth="2" />
      <path
        d="M40 57.5v-4M49 61l2.8-2.8M31 61l-2.8-2.8M52.5 70h4M27.5 70h-4"
        strokeWidth="2"
      />
      <path d="M36 206h8" strokeWidth="2" />
    </svg>
  );
}

/** Two palms + a wind-swept Monterey cypress on a dune line (silhouette). */
export function Palms({className = '', style}: SvgProps) {
  return (
    <svg
      viewBox="0 0 260 200"
      fill="currentColor"
      className={`palms-art ${className}`}
      style={style}
      {...hidden}
    >
      <path d="M206 198c-2-18-1-34 3-48 3-10 9-18 16-24l2.4 2.2c-6.4 5.8-11.6 13-14.4 22-3.6 12-4.4 28-2.6 47.8z" />
      <path d="M214 148c-6-5-14-7-22-6l-4-3.4c7-1.6 15-.8 22 2.4zM220 128c-9-3-19-2-27 2l-3-3c9-4.6 20-5.4 30-1.8z" />
      <path d="M150 140c10-6 24-8 38-6 12-5 27-5 40 0 9-.4 16 2 20 6-14 3-30 3-46 1-17 3-35 3-52-1zM164 120c11-7 26-9 40-6 11-4 24-3 35 2 7 0 12 2 15 5-13 3-27 3-41 1-16 3-33 3-49-2zM180 100c9-6 21-8 33-5 9-3 19-2 27 2 5 0 9 2 11 4-10 2-21 2-32 1-13 2-27 2-39-2z" />
      <path d="M83 198c-3-30-1-70 8-112l3 .6c-8 40-10 80-7 111z" />
      <path d="M92 86c-12-14-30-18-48-12 14 0 26 5 34 14-14-6-30-4-42 6 16-4 30-1 41 6-10 3-18 10-22 20 10-8 21-12 32-12zM94 86c10-15 27-21 46-18-14 2-26 8-33 17 14-7 31-6 43 3-16-3-30-1-41 7 11 2 19 9 24 19-11-7-22-10-33-9zM93 84c-1-14-8-26-20-32 10 7 15 17 17 28 3-12 11-22 22-26-11 1-19 8-24 17z" />
      <path d="M42 198c-2-20 0-44 6-66l2.8.5c-5 22-7 44-5.5 65z" />
      <path d="M49 132c-8-9-19-12-31-8 9 0 17 3 22 9-9-3-19-2-27 4 10-2 19-1 26 4-6 2-11 6-14 13 7-5 14-8 21-8zM51 132c7-10 18-13 30-11-9 1-17 5-21 11 9-4 20-3 28 2-10-2-19 0-26 5 7 1 12 6 15 12-7-4-14-6-21-6z" />
      <path d="M0 198c40-6 90-8 130-4 40 4 90 3 130-2v8H0z" />
    </svg>
  );
}

export type DoodleName =
  | 'wave'
  | 'sun'
  | 'van'
  | 'board'
  | 'photo'
  | 'bulb'
  | 'hand'
  | 'shell'
  | 'sparkle';

/** 24×24 doodle icon from the cached sprite at /illustrations/doodles.svg. */
export function Doodle({
  name,
  size = 24,
  className = '',
}: {
  name: DoodleName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={`doodle ${className}`}
      {...hidden}
    >
      <use href={`/illustrations/doodles.svg#d-${name}`} />
    </svg>
  );
}
