import {Link, useLoaderData} from 'react-router';
import {Suspense, useEffect, useState} from 'react';
import {Await} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {useInView} from '~/lib/useInView';
import {getDictionary, detectLocaleFromRequest} from '~/lib/i18n';

export const meta = ({data}) => {
  const dict = data?.dict ?? getDictionary('he');
  return [
    {title: dict.meta.title},
    {name: 'description', content: dict.meta.description},
  ];
};

/** @param {Route.LoaderArgs} args */
export async function loader(args) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, request}) {
  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
  ]);
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    featuredCollection: collections?.nodes?.[0] ?? null,
    dict,
    locale,
  };
}

function loadDeferredData({context}) {
  const featuredProduct = context.storefront
    .query(FEATURED_PRODUCT_QUERY)
    .catch((error) => {
      console.error(error);
      return null;
    });
  return {featuredProduct};
}

export default function Homepage() {
  const data = useLoaderData();
  return (
    <>
      <Hero />
      <FeaturedLightboard featuredProduct={data.featuredProduct} />
      <Story />
      <Faq />
      <Testimonials />
    </>
  );
}

/* ---------------- MOTION HELPERS ---------------- */

function Reveal({className = '', delay = 0, children, style}) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`reveal${inView ? ' is-in' : ''}${className ? ` ${className}` : ''}`}
      style={{transitionDelay: `${delay}ms`, ...style}}
    >
      {children}
    </div>
  );
}

function CountUp({value, active, duration = 1400}) {
  const match = /^(\D*)([\d,]+)(.*)$/.exec(String(value));
  const target = match ? parseInt(match[2].replace(/,/g, ''), 10) : 0;
  const hasMatch = Boolean(match);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!hasMatch || !active) return undefined;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setN(target);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasMatch, active, target, duration]);
  if (!match) return value;
  const [, prefix, num, suffix] = match;
  const display = num.includes(',') ? n.toLocaleString('en-US') : String(n);
  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  );
}

function StoryStat({n, k, delay}) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`stat reveal${inView ? ' is-in' : ''}`}
      style={{transitionDelay: `${delay}ms`}}
    >
      <b>
        <CountUp value={n} active={inView} />
      </b>
      {k}
    </div>
  );
}

/* ---------------- HERO ---------------- */

const HERO_SLIDES = [
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/mikail-mcverry-6WRjFofNhPs-unsplash.jpg?v=1777136172',
    label: 'VAN LIFE · BEACH PARK',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/tim-marshall-hIHh4E4_OGA-unsplash.jpg?v=1777138490',
    label: 'SURF · OFFSHORE',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/leo_visions-SzJo8G7BP8E-unsplash.jpg?v=1777136172',
    label: 'WAKE UP · OCEAN VIEW',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/sean-stratton-iQsa35lj2iE-unsplash.jpg?v=1777138490',
    label: 'SKATE · BOWL DAY',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/mads-schmidt-rasmussen-tSp5_w9h5TQ-unsplash.jpg?v=1777136172',
    label: 'SNOW · GOLDEN HOUR',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/john-o-nelio-czM5xBzedXA-unsplash.jpg?v=1777136171',
    label: 'COAST · SUNSET ROAD',
  },
];

const HERO_SRCSET_WIDTHS = [900, 1400, 2000, 2800];

function heroSrcSet(url) {
  return HERO_SRCSET_WIDTHS.map((w) => `${url}&width=${w} ${w}w`).join(', ');
}

const STORY_IMAGE =
  'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/paulina-herpel-NYsnCI23XJc-unsplash.jpg?v=1777141874';

function Hero() {
  const {dict, to} = useI18n();
  const h = dict.hero;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(
      () => setI((x) => (x + 1) % HERO_SLIDES.length),
      5200,
    );
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {HERO_SLIDES.map((s, j) => (
        <div
          key={s.img}
          className="hero-media"
          style={{
            opacity: j === i ? 1 : 0,
            transform: j === i ? 'scale(1.02)' : 'scale(1)',
            transitionProperty: 'opacity, transform',
            transitionDuration: '1.2s, 6s',
            transitionTimingFunction: 'ease',
          }}
        >
          <img
            src={`${s.img}&width=2000`}
            srcSet={heroSrcSet(s.img)}
            sizes="100vw"
            alt=""
            loading={j === 0 ? 'eager' : 'lazy'}
            fetchPriority={j === 0 ? 'high' : 'low'}
            draggable={false}
          />
        </div>
      ))}
      <div className="container hero-inner">
        <div className="hero-eyebrow">
          <span className="tick" />
          <span>{h.eyebrow}</span>
          <span style={{opacity: 0.5, margin: '0 8px'}}>/</span>
          <span style={{fontFamily: 'var(--mono)', opacity: 0.85}}>
            {HERO_SLIDES[i].label}
          </span>
        </div>
        <h1 className="hero-title">
          {h.titleLine1}
          <br />
          <em>{h.titleLine2}</em>
        </h1>
        <div className="hero-meta">
          <p className="hero-kicker">{h.kicker}</p>
          <Link to={to('/collections')} prefetch="intent" className="hero-cta">
            <span>{h.cta}</span>
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="hero-dots" role="tablist" aria-label={h.cta}>
          {HERO_SLIDES.map((s, j) => (
            <button
              key={s.img}
              onClick={() => setI(j)}
              aria-label={`${h.slideAria} ${j + 1}`}
              aria-selected={j === i}
              role="tab"
              className={j === i ? 'on' : ''}
              type="button"
            />
          ))}
          <span className="count">
            {String(i + 1).padStart(2, '0')} /{' '}
            {String(HERO_SLIDES.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="scroll-hint" aria-hidden="true">SCROLL</div>

      <div className="hero-tape" aria-hidden="true">
        <div className="hero-tape-track">
          <span>
            {[...h.tape, ...h.tape, ...h.tape].map((s, k) => (
              // The tape is intentionally tripled for seamless scroll; index
              // is the only stable key since each string repeats three times.
              // eslint-disable-next-line react/no-array-index-key
              <span key={k} style={{display: 'inline-flex', alignItems: 'center', gap: 48}}>
                <span>{s}</span>
                <span className="dot-sep" />
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FEATURED ---------------- */

function FeaturedLightboard({featuredProduct}) {
  const {dict} = useI18n();
  const f = dict.featured;
  const [finish, setFinish] = useState(f.finishes[0]);
  const swatchColors = {
    turquoise: '#3bb7c4',
    sand: '#d4b08a',
    black: '#1a1a1a',
  };
  return (
    <section className="feat3" id="featured">
      <div className="feat3-marker">
        <span>{f.marker}</span>
      </div>

      <div className="feat3-grid">
        <div className="feat3-stage">
          <img
            src="/lightboard-lifestyle.png"
            alt={f.titlePrefix + f.titleName}
            className="feat3-photo"
            loading="eager"
          />
          <div className="feat3-tags">
            <span className="feat3-tag">{f.tagMadeToOrder}</span>
            <span className="feat3-tag alt">{f.tagDimensions}</span>
          </div>
        </div>

        <div className="feat3-rail">
          <Reveal>
            <div className="feat3-eye">{f.eyebrow}</div>
            <h2 className="feat3-title">
              {f.titlePrefix}
              <em>{f.titleName}</em>
            </h2>
            <p className="feat3-desc">{f.desc}</p>
          </Reveal>

          <div className="feat3-ticker">
            {f.specs.map((s) => (
              <div className="feat3-tick" key={s.k}>
                <span className="k">{s.k}</span>
                <span className="v">{s.v}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="feat3-picker-head">
              <span>{f.finishLabel}</span>
              <span className="current">{finish.label}</span>
            </div>
            <div className="feat3-swatches">
              {f.finishes.map((fn) => (
                <button
                  key={fn.id}
                  onClick={() => setFinish(fn)}
                  className={`feat3-swatch ${finish.id === fn.id ? 'on' : ''}`}
                  aria-pressed={finish.id === fn.id}
                  type="button"
                >
                  <span
                    className="dot"
                    style={{background: swatchColors[fn.id] ?? '#999'}}
                    aria-hidden="true"
                  />
                  <span>{fn.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Suspense
            fallback={
              <BuyBar
                price="149"
                note={f.shipNote}
                ctaPrimary={f.ctaPrimary}
                ctaSecondary={f.ctaSecondary}
                handle="lightboard"
              />
            }
          >
            <Await
              resolve={featuredProduct}
              errorElement={
                <BuyBar
                  price="149"
                  note={f.shipNote}
                  ctaPrimary={f.ctaPrimary}
                  ctaSecondary={f.ctaSecondary}
                  handle="lightboard"
                />
              }
            >
              {(data) => {
                const product = data?.products?.nodes?.[0];
                const handle = product?.handle ?? 'lightboard';
                const amount = product?.priceRange?.minVariantPrice?.amount;
                const price = amount
                  ? String(Math.round(parseFloat(amount)))
                  : '149';
                return (
                  <BuyBar
                    price={price}
                    note={f.shipNote}
                    ctaPrimary={f.ctaPrimary}
                    ctaSecondary={f.ctaSecondary}
                    handle={handle}
                  />
                );
              }}
            </Await>
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function BuyBar({price, note, ctaPrimary, ctaSecondary, handle}) {
  const {to} = useI18n();
  const href = to(`/products/${handle}`);
  return (
    <div className="feat3-buy">
      <div className="feat3-price">
        <span className="cur">₪</span>
        <span className="num">{price}</span>
        <span className="note">{note}</span>
      </div>
      <div className="feat3-actions">
        <Link to={href} prefetch="intent" className="feat3-cta">
          <span>{ctaPrimary}</span>
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
        <Link to={href} prefetch="intent" className="feat3-ghost">
          {ctaSecondary}
        </Link>
      </div>
    </div>
  );
}

/* ---------------- STORY ---------------- */

function Story() {
  const {dict} = useI18n();
  const s = dict.story;
  return (
    <section className="story" id="story">
      <div className="container">
        <div className="section-horizon" aria-hidden="true" />
        <div className="story-grid">
          <div className="story-media">
            <span className="tag">{s.tag}</span>
            <img
              src={`${STORY_IMAGE}&width=1200`}
              srcSet={[600, 900, 1200, 1600]
                .map((w) => `${STORY_IMAGE}&width=${w} ${w}w`)
                .join(', ')}
              sizes="(min-width: 900px) 50vw, 100vw"
              alt={s.titleLine2}
              loading="lazy"
            />
          </div>
          <div className="story-copy">
            <Reveal>
              <div className="section-eyebrow" style={{marginBottom: 24}}>
                <span>{s.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h2>
                {s.titleLine1}
                <br />
                <em>{s.titleLine2}</em>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p>{s.p1}</p>
              <p>{s.p2}</p>
            </Reveal>
            <div className="story-stats">
              {s.stats.map((st, idx) => (
                <StoryStat
                  key={`${st.n}-${st.k}`}
                  n={st.n}
                  k={st.k}
                  delay={idx * 120}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function Faq() {
  const {dict} = useI18n();
  const f = dict.faq;
  const [open, setOpen] = useState(0);
  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="section-horizon" aria-hidden="true" />
      </div>
      <div className="container faq-container">
        <header className="faq-head">
          <Reveal>
            <div className="section-eyebrow">
              <span>{f.eyebrow}</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="section-title faq-title">
              {f.titleLine1}
              <br />
              <em>{f.titleLine2}</em>
            </h2>
          </Reveal>
        </header>
        <ul className="faq-list" role="list">
          {f.items.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <li className={`faq-item${isOpen ? ' open' : ''}`} key={item.q}>
                <button
                  type="button"
                  className="faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : idx)}
                >
                  <span className="faq-q-text">{item.q}</span>
                  <span className="faq-mark" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <div className="faq-a-wrap" aria-hidden={!isOpen}>
                  <div className="faq-a">
                    <p>{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------------- TESTIMONIALS ---------------- */

function Testimonials() {
  const {dict} = useI18n();
  const t = dict.testify;
  const quotes = t.items;
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % quotes.length), 6200);
    return () => clearInterval(id);
  }, [quotes.length]);
  const q = quotes[i];
  return (
    <section className="testify">
      <div className="container">
        <div className="section-horizon" aria-hidden="true" />
        <Reveal>
          <div
            className="section-eyebrow"
            style={{justifyContent: 'center', display: 'inline-flex', marginBottom: 32}}
          >
            <span>{t.eyebrow}</span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div style={{position: 'relative', minHeight: 240}}>
            <blockquote key={i} style={{animation: 'fadeUp 0.5s ease both'}}>
              «{q.a}
              <em>{q.b}</em>
              {q.c}»
            </blockquote>
            <div className="attribution">{q.who}</div>
          </div>
        </Reveal>
        <div className="testify-nav">
          <button
            type="button"
            onClick={() => setI((x) => (x - 1 + quotes.length) % quotes.length)}
            aria-label={t.prev}
            className="testify-nav-btn"
          >
            ←
          </button>
          <div className="testify-dots">
            {quotes.map((q, j) => (
              <button
                key={q.who}
                onClick={() => setI(j)}
                aria-label={`${t.eyebrow.trim()} ${j + 1}`}
                className={j === i ? 'on' : ''}
                type="button"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setI((x) => (x + 1) % quotes.length)}
            aria-label={t.next}
            className="testify-nav-btn"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------------- QUERIES ---------------- */

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image { id url altText width height }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes { ...FeaturedCollection }
    }
  }
`;

const FEATURED_PRODUCT_QUERY = `#graphql
  query FeaturedProduct($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        priceRange {
          minVariantPrice { amount currencyCode }
        }
        featuredImage { id url altText width height }
      }
    }
  }
`;

/** @typedef {import('./+types/($locale)._index').Route} Route */
