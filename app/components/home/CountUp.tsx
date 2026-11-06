import {useEffect, useState} from 'react';
import {prefersNoMotion} from '~/lib/motion';

type CountUpProps = {
  value: string | number;
  active: boolean;
  duration?: number;
};

/**
 * Counts the number inside `value` (e.g. "1,200+" or "7 שנים") up from 0
 * once `active` turns true. Non-numeric values render as-is.
 */
export function CountUp({value, active, duration = 1400}: CountUpProps) {
  const match = /^(\D*)([\d,]+)(.*)$/.exec(String(value));
  const target = match ? parseInt(match[2].replace(/,/g, ''), 10) : 0;
  const hasMatch = Boolean(match);
  // Server HTML (and no-JS / crawlers / reduced motion) gets the real final
  // number. Only on the client, before the stat scrolls into view, do we
  // reset to 0 so the count-up can play.
  const [n, setN] = useState(target);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!hasMatch || active) return;
    if (prefersNoMotion()) return;
    setN(0);
    setArmed(true);
    // Mount-only: arm once, before the first intersection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hasMatch || !active) return undefined;
    if (!armed) {
      setN(target);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `armed` only flips at mount while `active` is still false, so listing
    // it never restarts a running count.
  }, [hasMatch, active, armed, target, duration]);
  if (!match) return <>{value}</>;
  const [, prefix, num, suffix] = match;
  const display = num.includes(',') ? n.toLocaleString('en-US') : String(n);
  // Split the suffix at the first whitespace so a trailing word (e.g.
  // " שנים") stays in the parent's RTL flow, while glued punctuation
  // like "%" rides along with the LTR-isolated number cluster.
  const suffixParts = /^(\S*)(\s.*)?$/.exec(suffix) ?? [];
  const inSuffix = suffixParts[1] ?? '';
  const outSuffix = suffixParts[2] ?? '';
  return (
    <>
      <bdi dir="ltr">
        {prefix}
        {display}
        {inSuffix}
      </bdi>
      {outSuffix}
    </>
  );
}
