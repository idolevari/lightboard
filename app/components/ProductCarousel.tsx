import {useCallback, useEffect, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Image} from '@shopify/hydrogen';
import {prefersNoMotion} from '~/lib/motion';

export type CarouselImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

type Labels = {
  /** Accessible name of the whole carousel, e.g. "Lightboard photos". */
  carousel: string;
  /** Per-slide label template with `{n}` and `{total}`. */
  slide: string;
  /** Indicator button label template with `{n}` and `{total}`. */
  goTo: string;
  prev: string;
  next: string;
};

type Props = {
  images: Array<CarouselImage>;
  /** Alt fallback for images without alt text (product name). */
  fallbackAlt: string;
  labels: Labels;
  sizes: string;
  className?: string;
};

function fill(template: string, n: number, total: number) {
  return template.replace('{n}', String(n)).replace('{total}', String(total));
}

/**
 * Swipeable product photo carousel: a CSS scroll-snap track (native touch
 * swipe, no library), bar indicators inside the photo, and prev/next arrows
 * on fine-pointer screens. Never autoplays. Direction-agnostic: positions are
 * measured with getBoundingClientRect, so it works the same in RTL and LTR.
 */
export function ProductCarousel({
  images,
  fallbackAlt,
  labels,
  sizes,
  className = '',
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = images.length;

  // Track which slide is mostly in view (works for swipe, keyboard, arrows).
  useEffect(() => {
    const track = trackRef.current;
    if (!track || total < 2) return;
    const slides = Array.from(track.children) as Array<HTMLElement>;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = slides.indexOf(entry.target as HTMLElement);
            if (index >= 0) setActive(index);
          }
        }
      },
      {root: track, threshold: 0.6},
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [total]);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(total - 1, index));
      const slide = track.children[clamped] as HTMLElement | undefined;
      if (!slide) return;
      const delta =
        slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
      track.scrollBy({
        left: delta,
        behavior: prefersNoMotion() ? 'auto' : 'smooth',
      });
      setActive(clamped);
    },
    [total],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl =
      getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = active + rtl;
    else if (event.key === 'ArrowLeft') next = active - rtl;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = total - 1;
    if (next === null) return;
    event.preventDefault();
    goTo(next);
  }

  if (total === 0) return null;

  return (
    // Arrow / Home / End keys move between photos from anywhere inside.
    <div
      className={`pcar ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.carousel}
      onKeyDown={total > 1 ? onKeyDown : undefined}
    >
      <div
        ref={trackRef}
        className="pcar-track"
        // Focusable so keyboard users can scroll it; arrow keys are handled
        // by the region above.
        tabIndex={total > 1 ? 0 : undefined}
        aria-live="polite"
      >
        {images.map((image, i) => (
          <div
            key={image.id ?? image.url}
            className="pcar-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={fill(labels.slide, i + 1, total)}
            aria-hidden={total > 1 && i !== active ? true : undefined}
          >
            <Image
              data={image}
              alt={image.altText || fallbackAlt}
              className="pcar-photo"
              sizes={sizes}
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className="pcar-arrow pcar-arrow--prev"
            aria-label={labels.prev}
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
          >
            <Chevron />
          </button>
          <button
            type="button"
            className="pcar-arrow pcar-arrow--next"
            aria-label={labels.next}
            onClick={() => goTo(active + 1)}
            disabled={active === total - 1}
          >
            <Chevron />
          </button>
          <div className="pcar-bars">
            {images.map((image, i) => (
              <button
                key={image.id ?? image.url}
                type="button"
                className={`pcar-bar${i === active ? ' is-active' : ''}`}
                aria-label={fill(labels.goTo, i + 1, total)}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(i)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Points to the inline-end ("next") side; CSS mirrors it for prev / RTL. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
