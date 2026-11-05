import {useEffect} from 'react';
import {useI18n} from '~/lib/useI18n';

/**
 * Lazy-loads the handwritten accent face (Amatic SC 700 — Google Fonts,
 * has a Hebrew subset) for the 1–3 `.hand-note` annotations per page.
 *
 * Font budget: the stylesheet is requested with `text=` holding only the
 * glyphs of the annotation strings (≈5 KB woff2 instead of ~18 KB for the
 * full Hebrew subset) and is injected after `load` + idle, so it is never
 * render-blocking and never competes with LCP. Until it arrives (or if it
 * never does) the notes render in Ploni via the `--hand` stack.
 */
export function HandFont() {
  const {dict} = useI18n();
  const strings = Object.values(dict.hand ?? {}).join('');
  useEffect(() => {
    if (!strings) return undefined;
    const glyphs = Array.from(new Set(Array.from(strings)))
      .filter((ch) => ch.trim())
      .join('');
    const href = `https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&display=swap&text=${encodeURIComponent(glyphs)}`;
    let idleId: number | undefined;
    const inject = () => {
      if (document.querySelector('link[data-hand-font]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.handFont = '';
      document.head.appendChild(link);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const schedule = () => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(inject, {timeout: 4000});
      else idleId = window.setTimeout(inject, 2000);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, {once: true});
    return () => {
      window.removeEventListener('load', schedule);
      if (idleId !== undefined) {
        if (w.cancelIdleCallback) w.cancelIdleCallback(idleId);
        else window.clearTimeout(idleId);
      }
    };
  }, [strings]);
  return null;
}
