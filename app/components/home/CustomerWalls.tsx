import {useI18n} from '~/lib/useI18n';
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
    handle: 'shalev_kayam',
    src: '/customers/shalev-kayam.webp',
    width: 330,
    height: 205,
  },
];

export function CustomerWalls() {
  const {dict} = useI18n();
  const t = dict.customerWalls;
  if (!t) return null;
  return (
    <section className="walls" aria-labelledby="walls-title">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">{t.eyebrow}</div>
          <h2 id="walls-title" className="walls-title">
            {t.title}
          </h2>
        </Reveal>
        <ul className="walls-list" role="list">
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
