import {useRef} from 'react';
import {useI18n} from '~/lib/useI18n';
import {prefersNoMotion} from '~/lib/motion';
import {Reveal} from './Reveal';

/**
 * Real customer photos reshared on the shop's Instagram stories
 * (@lightboardshop, "Your Stories" highlight). Quotes are the customers' own
 * captions, word for word; a photo without a caption gets no quote. Only
 * product shots are used (no customer faces), each credited by the handle
 * the customer posted under.
 */
type CustomerWall = {
  handle: string;
  src: string;
  width: number;
  height: number;
  /** The customer's own caption, in the language they wrote it. */
  quote?: {text: string; lang: 'he' | 'en'};
};

const CUSTOMER_WALLS: CustomerWall[] = [
  {
    handle: 'ofirshukrun',
    src: '/customers/ofirshukrun.webp',
    width: 350,
    height: 250,
    quote: {text: 'מושלם לי בחדר ✨', lang: 'he'},
  },
  {
    handle: 'adi.mordoch',
    src: '/customers/adi-mordoch.webp',
    width: 350,
    height: 455,
    quote: {text: 'איפה עוד תמצאו חברה כזו 😍', lang: 'he'},
  },
  {
    handle: 'dawn._.s',
    src: '/customers/dawn-s.webp',
    width: 321,
    height: 242,
    quote: {text: 'Shout out to @lightboardshop. Amazing work', lang: 'en'},
  },
  {
    handle: 'shelly_safit',
    src: '/customers/shelly-safit.webp',
    width: 321,
    height: 240,
    quote: {text: 'Tnx @lightboardshop 🤍', lang: 'en'},
  },
  {
    handle: 'rotemschwartz_',
    src: '/customers/rotemschwartz.webp',
    width: 335,
    height: 250,
  },
  {
    handle: 'yuvalita',
    src: '/customers/yuvalita.webp',
    width: 264,
    height: 198,
  },
  {
    handle: 'noam_zilber',
    src: '/customers/noam-zilber.webp',
    width: 262,
    height: 172,
  },
  {
    handle: 'shalev_kayam',
    src: '/customers/shalev-kayam.webp',
    width: 330,
    height: 205,
  },
];

export function CustomerWalls() {
  const {dict} = useI18n();
  const t = dict.customerWalls;
  const listRef = useRef<HTMLUListElement>(null);
  if (!t) return null;

  // Scroll by one "page" of cards. Measured with getBoundingClientRect, so
  // the same code works in RTL and LTR: `forward` follows reading direction.
  const page = (forward: boolean) => {
    const list = listRef.current;
    if (!list) return;
    const rtl = getComputedStyle(list).direction === 'rtl';
    const step = list.clientWidth * 0.8 * (forward !== rtl ? 1 : -1);
    list.scrollBy({
      left: step,
      behavior: prefersNoMotion() ? 'auto' : 'smooth',
    });
  };
  return (
    <section className="walls" aria-labelledby="walls-title">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">{t.eyebrow}</div>
          <h2 id="walls-title" className="walls-title">
            {t.title}
          </h2>
        </Reveal>
        <div className="walls-nav">
          <button
            type="button"
            className="walls-arrow"
            aria-label={dict.common.previous}
            onClick={() => page(false)}
          >
            <Arrow back />
          </button>
          <button
            type="button"
            className="walls-arrow"
            aria-label={dict.common.next}
            onClick={() => page(true)}
          >
            <Arrow />
          </button>
        </div>
        {/* A scrollable region must be keyboard-focusable (WCAG 2.1.1). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <ul className="walls-list" role="list" ref={listRef} tabIndex={0}>
          {CUSTOMER_WALLS.map((wall, idx) => (
            <li key={wall.handle} className="walls-item">
              <Reveal delay={Math.min(idx, 4) * 80}>
                <figure className="walls-card">
                  <img
                    src={wall.src}
                    width={wall.width}
                    height={wall.height}
                    alt={`${t.photoAlt} @${wall.handle}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>
                    {wall.quote ? (
                      <blockquote
                        lang={wall.quote.lang}
                        dir={wall.quote.lang === 'he' ? 'rtl' : 'ltr'}
                      >
                        {wall.quote.text}
                      </blockquote>
                    ) : null}
                    <cite lang="en" dir="ltr">
                      @{wall.handle}
                    </cite>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className="walls-source">{t.source}</p>
      </div>
    </section>
  );
}

/** Chevron that points with the reading direction (mirrored in RTL by CSS). */
function Arrow({back = false}: {back?: boolean}) {
  return (
    <svg
      className={back ? 'walls-chevron is-back' : 'walls-chevron'}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
