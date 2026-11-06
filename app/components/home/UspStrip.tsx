import {useI18n} from '~/lib/useI18n';
import {Doodle} from '~/components/illustrations';
import type {DoodleName} from '~/components/illustrations';
import {Reveal} from './Reveal';

/** Row of brand promises (free shipping, handmade, ...) from i18n. */
export function UspStrip() {
  const {dict} = useI18n();
  const items = (dict.usp?.items ?? []) as Array<{icon: string; label: string}>;
  if (items.length === 0) return null;
  return (
    <section className="usp" aria-label={dict.usp.label}>
      <ul className="usp-list container" role="list">
        {items.map((item, idx) => (
          <li key={item.label} className="usp-item">
            <Reveal delay={Math.min(idx, 4) * 80} className="usp-reveal">
              <Doodle name={item.icon as DoodleName} size={30} />
              <span>{item.label}</span>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
