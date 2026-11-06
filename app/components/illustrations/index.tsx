/**
 * "Golden Hour Van" illustration kit — hand-drawn SVGs inlined as tiny
 * components so they theme through `currentColor` and CSS custom properties
 * (`--sun`, `--board`, `--bulb`, `--wave-line`, …) and can animate (see the
 * app/styles/motion.css).
 *
 * Every illustration here is decorative: `aria-hidden` + `focusable=false`.
 * Explicit width/height or aspect-ratio boxes keep CLS at 0.
 *
 * Looping animations only run while the wrapper carries `.is-live`
 * (see <LiveLoop/>), and never under prefers-reduced-motion or the
 * accessibility menu's "stop animations" switch.
 */
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

export type DoodleName =
  | 'wave'
  | 'sun'
  | 'van'
  | 'board'
  | 'photo'
  | 'bulb'
  | 'hand'
  | 'heart'
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
