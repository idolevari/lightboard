/**
 * Shared "should we animate?" check: the OS `prefers-reduced-motion`
 * setting OR the accessibility menu's "stop animations" switch (which adds
 * `body.a11y-no-motion` and fires MOTION_EVENT so carousels can re-check).
 */
export const MOTION_EVENT = 'lb:motion-change';
export const NO_MOTION_CLASS = 'a11y-no-motion';

export function prefersNoMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains(NO_MOTION_CLASS)
  );
}
