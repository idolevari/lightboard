import {useCallback, useEffect, useState} from 'react';
import type {FocusEvent} from 'react';
import {MOTION_EVENT, prefersNoMotion} from '~/lib/motion';

/**
 * Shared carousel timing for the hero (WCAG 2.2.2):
 * - never auto-advances under prefers-reduced-motion;
 * - a visible pause/play button (`userPaused`) wins over everything;
 * - pauses while hovered, while keyboard focus is inside, and while the
 *   tab is hidden.
 */
export function useAutoRotate(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // OS setting, or the accessibility menu's "stop animations" switch.
    const sync = () => setReducedMotion(prefersNoMotion());
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener(MOTION_EVENT, sync);
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener(MOTION_EVENT, sync);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const paused =
    userPaused || hoverPaused || focusPaused || reducedMotion || hidden;

  useEffect(() => {
    if (paused || count <= 1) return undefined;
    const id = setInterval(() => setIndex((x) => (x + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [paused, count, intervalMs]);

  const handlers = {
    onMouseEnter: () => setHoverPaused(true),
    onMouseLeave: () => setHoverPaused(false),
    onFocus: () => setFocusPaused(true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setFocusPaused(false);
      }
    },
    // Touch: no auto-pause on pointerdown — every scroll gesture over the
    // hero starts with one. Touch users get the explicit pause button.
  };

  return {
    index,
    setIndex,
    paused,
    // The button reflects the visitor's own choice (or reduced motion).
    stopped: userPaused || reducedMotion,
    toggle: useCallback(() => {
      setUserPaused((p) => !(p || reducedMotion));
      if (reducedMotion) setReducedMotion(false);
    }, [reducedMotion]),
    handlers,
  };
}
