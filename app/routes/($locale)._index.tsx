import {Await, Link, useLoaderData} from 'react-router';
import {Suspense, useEffect, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {useInView} from '~/lib/useInView';
import {getDictionary, detectLocaleFromRequest} from '~/lib/i18n';
import {
  getOptionValueHex,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {RouteError} from '~/components/RouteError';
import type {Route} from './+types/($locale)._index';

// ---- Local shape types for the GraphQL responses on this route ----

type AliasedField = {value?: string | null} | null | undefined;

type HeroAliasedNode = {
  eyebrow_he?: AliasedField;
  eyebrow_en?: AliasedField;
  title_line_1_he?: AliasedField;
  title_line_1_en?: AliasedField;
  title_line_2_he?: AliasedField;
  title_line_2_en?: AliasedField;
  kicker_he?: AliasedField;
  kicker_en?: AliasedField;
  cta_he?: AliasedField;
  cta_en?: AliasedField;
  tape_items_he?: AliasedField;
  tape_items_en?: AliasedField;
};

type StoryStatNode = {
  id: string;
  value?: AliasedField;
  label_he?: AliasedField;
  label_en?: AliasedField;
  position?: AliasedField;
};

type StoryAliasedNode = {
  tag?: AliasedField;
  eyebrow_he?: AliasedField;
  eyebrow_en?: AliasedField;
  title_line_1_he?: AliasedField;
  title_line_1_en?: AliasedField;
  title_line_2_he?: AliasedField;
  title_line_2_en?: AliasedField;
  p1_he?: AliasedField;
  p1_en?: AliasedField;
  p2_he?: AliasedField;
  p2_en?: AliasedField;
  stats?:
    | {references?: {nodes?: Array<StoryStatNode>} | null}
    | null;
};

type ProductSpecNode = {
  id: string;
  label_he?: AliasedField;
  label_en?: AliasedField;
  value_he?: AliasedField;
  value_en?: AliasedField;
  position?: AliasedField;
};

type HeroSlideField = {
  key: string;
  value?: string | null;
  reference?: {image?: {url: string} | null} | null;
};

type HeroSlideNode = {
  id: string;
  handle?: string;
  fields?: Array<HeroSlideField>;
};

type SimpleMetaobjectField = {key: string; value?: string | null};

type SimpleMetaobjectNode = {
  id: string;
  handle?: string;
  fields?: Array<SimpleMetaobjectField>;
};

type FieldMapping = {target: string; heKey: string; enKey: string};

type HeroSection = {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  kicker: string;
  cta: string;
  tape: Array<string>;
};

type StorySectionStat = {
  id: string;
  n: string;
  k: string;
  position: number;
};

type StorySection = {
  tag: string;
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  p1: string;
  p2: string;
  stats: Array<StorySectionStat>;
};

type HeroSlide = {
  id: string;
  img: string | null;
  label: string;
  mobilePos: string | undefined;
  position: number;
};

type MetaobjectFieldRecord = {
  id: string;
  position: number;
  [key: string]: string | number;
};

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

type SimpleMetaobjectQueryResponse = {
  metaobjects?: {nodes?: Array<SimpleMetaobjectNode>} | null;
} | null;

export async function loader(args: Route.LoaderArgs) {
  // Launch-gate: do not fetch products/collections when the public site is
  // closed; the root layout renders <ComingSoon /> instead.
  if (isLaunchGateActive(args.request, args.context.env)) {
    const locale = detectLocaleFromRequest(args.request);
    const dict = getDictionary(locale);
    const {seo, jsonLd} = simpleSeo({
      title: dict.meta.title,
      description: dict.meta.description,
      url: absoluteUrl('/', locale),
    });
    return {
      isShopLinked: false,
      featuredCollection: null,
      featuredProduct: null,
      faqs: Promise.resolve(
        null,
      ) as Promise<SimpleMetaobjectQueryResponse | null>,
      testimonials: Promise.resolve(
        null,
      ) as Promise<SimpleMetaobjectQueryResponse | null>,
      heroSlides: [] as Array<HeroSlide>,
      hero: null as HeroSection | null,
      story: null as StorySection | null,
      dict,
      locale,
      seo,
      jsonLd,
    };
  }
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const {storefront} = context;
  const [{collections}, productData, heroData, homepageData] = await Promise.all([
    storefront.query(FEATURED_COLLECTION_QUERY, {
      cache: storefront.CacheLong(),
    }),
    storefront
      .query(FEATURED_PRODUCT_QUERY, {cache: storefront.CacheShort()})
      .catch((error) => {
        console.error(error);
        return null;
      }),
    storefront
      .query(HERO_SLIDES_QUERY, {cache: storefront.CacheLong()})
      .catch((error) => {
        console.error(error);
        return null;
      }),
    storefront
      .query(HOMEPAGE_SECTIONS_QUERY, {cache: storefront.CacheLong()})
      .catch((error) => {
        console.error(error);
        return null;
      }),
  ]);
  const featuredProduct = productData?.shop?.featured?.reference ?? null;
  const {seo: baseSeo, jsonLd} = simpleSeo({
    title: dict.meta.title,
    description: dict.meta.description,
    url: absoluteUrl('/', locale),
  });
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    featuredCollection: collections?.nodes?.[0] ?? null,
    featuredProduct,
    heroSlides: extractHeroSlides(heroData?.metaobjects?.nodes),
    hero: extractHeroSection(homepageData?.shop?.hero?.reference, locale),
    story: extractStorySection(homepageData?.shop?.story?.reference, locale),
    dict,
    locale,
    seo: {
      ...baseSeo,
      media: featuredProduct?.featuredImage?.url
        ? {
            type: 'image' as const,
            url: featuredProduct.featuredImage.url,
            height: featuredProduct.featuredImage.height ?? 1200,
            width: featuredProduct.featuredImage.width ?? 1200,
            altText: featuredProduct.featuredImage.altText ?? null,
          }
        : undefined,
    },
    jsonLd,
  };
}

/**
 * Non-blocking queries returned as unresolved promises so the FAQ and
 * testimonial sections can stream in below the fold instead of holding up
 * first paint. Each query catches its own error and resolves to `null` so a
 * downstream failure renders nothing rather than 500-ing the homepage.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const faqs = storefront
    .query(FAQS_QUERY, {cache: storefront.CacheLong()})
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  const testimonials = storefront
    .query(TESTIMONIALS_QUERY, {cache: storefront.CacheLong()})
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  return {faqs, testimonials};
}

/**
 * Pick the locale-appropriate value from a `{<base>_he, <base>_en}` field
 * pair on a metaobject reference response. Falls back to Hebrew when the
 * English value is empty so the storefront never renders a blank.
 */
function pickField(
  node: Record<string, AliasedField> | null | undefined,
  base: string,
  locale: string,
): string {
  const he = node?.[`${base}_he`]?.value;
  const en = node?.[`${base}_en`]?.value;
  return locale === 'en' ? en || he || '' : he || '';
}

function extractHeroSection(
  node: HeroAliasedNode | null | undefined,
  locale: string,
): HeroSection | null {
  if (!node) return null;
  let tapeItems: Array<string> = [];
  const tapeRaw = (
    node as Record<string, AliasedField>
  )[`tape_items_${locale === 'en' ? 'en' : 'he'}`]?.value;
  const tapeFallback = node.tape_items_he?.value;
  try {
    const parsed: unknown = JSON.parse(tapeRaw ?? tapeFallback ?? '[]');
    tapeItems = Array.isArray(parsed) ? (parsed as Array<string>) : [];
  } catch {
    tapeItems = [];
  }
  return {
    eyebrow: pickField(node as Record<string, AliasedField>, 'eyebrow', locale),
    titleLine1: pickField(node as Record<string, AliasedField>, 'title_line_1', locale),
    titleLine2: pickField(node as Record<string, AliasedField>, 'title_line_2', locale),
    kicker: pickField(node as Record<string, AliasedField>, 'kicker', locale),
    cta: pickField(node as Record<string, AliasedField>, 'cta', locale),
    tape: tapeItems,
  };
}

function extractStorySection(
  node: StoryAliasedNode | null | undefined,
  locale: string,
): StorySection | null {
  if (!node) return null;
  const statRefs = node?.stats?.references?.nodes ?? [];
  const stats: Array<StorySectionStat> = statRefs
    .map((s) => ({
      id: s.id,
      n: s.value?.value ?? '',
      k:
        locale === 'en'
          ? s.label_en?.value || s.label_he?.value || ''
          : s.label_he?.value || '',
      position: parseInt(s.position?.value ?? '0', 10) || 0,
    }))
    .sort((a, b) => a.position - b.position);
  return {
    tag: node?.tag?.value ?? '',
    eyebrow: pickField(node as Record<string, AliasedField>, 'eyebrow', locale),
    titleLine1: pickField(node as Record<string, AliasedField>, 'title_line_1', locale),
    titleLine2: pickField(node as Record<string, AliasedField>, 'title_line_2', locale),
    p1: pickField(node as Record<string, AliasedField>, 'p1', locale),
    p2: pickField(node as Record<string, AliasedField>, 'p2', locale),
    stats,
  };
}

/**
 * Reshape the hero_slide metaobjects into the {img, label, mobilePos} shape
 * the <Hero> component expects. Returns empty when no entries exist so the
 * component can fall back to the in-code defaults.
 */
function extractHeroSlides(
  nodes: Array<HeroSlideNode> | null | undefined,
): Array<HeroSlide> {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const items: Array<HeroSlide> = nodes
    .map((node) => {
      const byKey: Record<string, HeroSlideField> = Object.fromEntries(
        (node.fields ?? []).map((f) => [f.key, f]),
      );
      const imageField = byKey.image;
      const url = imageField?.reference?.image?.url ?? null;
      return {
        id: node.id,
        img: url,
        label: byKey.label?.value ?? '',
        mobilePos: byKey.mobile_position?.value ?? undefined,
        position: parseInt(byKey.position?.value ?? '0', 10) || 0,
      };
    })
    .filter((s) => s.img);
  items.sort((a, b) => a.position - b.position);
  return items;
}

/**
 * Reduce a metaobject result list to plain JS objects keyed by the chosen
 * locale's text. Falls back to the Hebrew variant when an English value is
 * empty so the storefront never renders a blank.
 */
function extractMetaobjectFields(
  nodes: Array<SimpleMetaobjectNode> | null | undefined,
  locale: string,
  mapping: Array<FieldMapping>,
): Array<MetaobjectFieldRecord> {
  if (!Array.isArray(nodes)) return [];
  const items: Array<MetaobjectFieldRecord> = nodes.map((node) => {
    const byKey: Record<string, string | null | undefined> = Object.fromEntries(
      (node.fields ?? []).map((f) => [f.key, f.value]),
    );
    const result: MetaobjectFieldRecord = {
      id: node.id,
      position: parseInt(byKey.position ?? '0', 10) || 0,
    };
    for (const {target, heKey, enKey} of mapping) {
      const he = byKey[heKey] ?? '';
      const en = byKey[enKey] ?? '';
      result[target] = locale === 'en' ? en || he : he;
    }
    return result;
  });
  items.sort((a, b) => a.position - b.position);
  return items;
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  const locale = data.locale;
  return (
    <>
      <Hero slides={data.heroSlides} content={data.hero} />
      <FeaturedLightboard featuredProduct={data.featuredProduct} />
      <Story content={data.story} />
      <Suspense fallback={<DeferredSectionFallback />}>
        <Await resolve={data.faqs}>
          {(faqsResponse) => {
            if (!faqsResponse) return null;
            const items = extractMetaobjectFields(
              faqsResponse?.metaobjects?.nodes,
              locale,
              [
                {target: 'question', heKey: 'question_he', enKey: 'question_en'},
                {target: 'answer', heKey: 'answer_he', enKey: 'answer_en'},
              ],
            );
            return <Faq items={items} />;
          }}
        </Await>
      </Suspense>
      <Suspense fallback={<DeferredSectionFallback />}>
        <Await resolve={data.testimonials}>
          {(testimonialsResponse) => {
            if (!testimonialsResponse) return null;
            const items = extractMetaobjectFields(
              testimonialsResponse?.metaobjects?.nodes,
              locale,
              [
                {target: 'body', heKey: 'body_he', enKey: 'body_en'},
                {
                  target: 'attribution',
                  heKey: 'attribution_he',
                  enKey: 'attribution_en',
                },
              ],
            );
            return <Testimonials items={items} />;
          }}
        </Await>
      </Suspense>
    </>
  );
}

// Empty placeholder while deferred sections stream in. Reserves vertical space
// to avoid CLS but is intentionally minimal — refine visually later if needed.
function DeferredSectionFallback() {
  return <div aria-hidden="true" style={{minHeight: '320px'}} />;
}

/* ---------------- MOTION HELPERS ---------------- */

type RevealProps = {
  className?: string;
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function Reveal({className = '', delay = 0, children, style}: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
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

type CountUpProps = {
  value: string | number;
  active: boolean;
  duration?: number;
};

function CountUp({value, active, duration = 1400}: CountUpProps) {
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
  }, [hasMatch, active, target, duration]);
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

function StoryStat({n, k, delay}: {n: string; k: string; delay: number}) {
  const [ref, inView] = useInView<HTMLDivElement>();
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

type HeroSlideForRender = {
  id?: string;
  img: string;
  label?: string;
  mobilePos?: string;
};

const HERO_SLIDES: Array<HeroSlideForRender> = [
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/mikail-mcverry-6WRjFofNhPs-unsplash.jpg?v=1777136172',
    label: 'VAN LIFE · BEACH PARK',
    // Van sits in the left ~60% of the frame; pull the mobile crop left
    // so the van stays visible instead of getting cut by a center crop.
    mobilePos: '30%',
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
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/mads-schmidt-rasmussen-tSp5_w9h5TQ-unsplash.jpg?v=1777136172',
    label: 'SNOW · GOLDEN HOUR',
    // Snowboarder is on the left third — keep them in the mobile crop.
    mobilePos: '30%',
  },
  {
    img: 'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/john-o-nelio-czM5xBzedXA-unsplash.jpg?v=1777136171',
    label: 'COAST · SUNSET ROAD',
    // Van anchors the right side of this frame; bias the mobile crop
    // right so we don't lose the van to a centered crop.
    mobilePos: '65%',
  },
];

const HERO_SRCSET_WIDTHS = [900, 1400, 2000, 2800];

function heroSrcSet(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return HERO_SRCSET_WIDTHS.map(
    (w) => `${url}${sep}width=${w} ${w}w`,
  ).join(', ');
}

const STORY_IMAGE =
  'https://cdn.shopify.com/s/files/1/0982/9325/2392/files/paulina-herpel-NYsnCI23XJc-unsplash.jpg?v=1777141874';

function Hero({
  slides,
  content,
}: {
  slides: Array<HeroSlide>;
  content: HeroSection | null;
}) {
  const {dict} = useI18n();
  // Slides + section copy both live in Shopify (metaobjects + shop metafield).
  // The slides have a code fallback so the page never renders empty; the
  // section copy renders only when the merchant has configured the
  // `homepage.hero` metafield.
  const activeSlides: Array<HeroSlideForRender> =
    Array.isArray(slides) && slides.length > 0
      ? slides
          .filter((s): s is HeroSlide & {img: string} => Boolean(s.img))
          .map((s) => ({
            id: s.id,
            img: s.img,
            label: s.label,
            mobilePos: s.mobilePos,
          }))
      : HERO_SLIDES;
  const tape = content?.tape ?? [];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(
      () => setI((x) => (x + 1) % activeSlides.length),
      5200,
    );
    return () => clearInterval(id);
  }, [paused, activeSlides.length]);

  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {activeSlides.map((s, j) => (
        <div
          key={s.id ?? s.img}
          className="hero-media"
          style={
            {
              opacity: j === i ? 1 : 0,
              transform: j === i ? 'scale(1.02)' : 'scale(1)',
              transitionProperty: 'opacity, transform',
              transitionDuration: '1.2s, 6s',
              transitionTimingFunction: 'ease',
              // Per-slide horizontal crop point used by the mobile media
              // query in app.css. Desktop stays centered.
              '--hero-pos-mobile': s.mobilePos ?? '50%',
            } as React.CSSProperties
          }
        >
          <img
            src={`${s.img}${s.img.includes('?') ? '&' : '?'}width=2000`}
            srcSet={heroSrcSet(s.img)}
            sizes="100vw"
            alt=""
            loading={j === 0 ? 'eager' : 'lazy'}
            // React 18 doesn't recognize the camelCase `fetchPriority` prop and
            // warns at runtime. Pass the DOM-native lowercase attribute via
            // spread so the browser honours it without React's warning.
            {...({fetchpriority: j === 0 ? 'high' : 'low'} as Record<string, string>)}
            draggable={false}
          />
        </div>
      ))}
      <div className="container hero-inner">
        {(content?.eyebrow || activeSlides[i]?.label) && (
          <div className="hero-eyebrow">
            <span className="tick" />
            {content?.eyebrow && <span>{content.eyebrow}</span>}
            {content?.eyebrow && activeSlides[i]?.label && (
              <span style={{opacity: 0.5, margin: '0 8px'}}>/</span>
            )}
            {activeSlides[i]?.label && (
              <span style={{fontFamily: 'var(--mono)', opacity: 0.85}}>
                {activeSlides[i].label}
              </span>
            )}
          </div>
        )}
        {(content?.titleLine1 || content?.titleLine2) && (
          <h1 className="hero-title">
            {content?.titleLine1}
            {content?.titleLine1 && content?.titleLine2 && <br />}
            {content?.titleLine2 && <em>{content.titleLine2}</em>}
          </h1>
        )}
        <div className="hero-meta">
          {content?.kicker && <p className="hero-kicker">{content.kicker}</p>}
          {content?.cta && (
            <a href="#featured" className="hero-cta">
              <span>{content.cta}</span>
              <span className="arrow" aria-hidden="true">→</span>
            </a>
          )}
        </div>
        <div className="hero-dots" role="tablist" aria-label={dict.hero.slideAria}>
          {activeSlides.map((s, j) => (
            <button
              key={s.id ?? s.img}
              onClick={() => setI(j)}
              aria-label={`${dict.hero.slideAria} ${j + 1}`}
              aria-selected={j === i}
              role="tab"
              className={j === i ? 'on' : ''}
              type="button"
            />
          ))}
          <span className="count">
            {String(i + 1).padStart(2, '0')} /{' '}
            {String(activeSlides.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="scroll-hint" aria-hidden="true">SCROLL</div>

      {tape.length > 0 && (
        <div className="hero-tape" aria-hidden="true">
          <div className="hero-tape-track">
            <span>
              {[...tape, ...tape, ...tape].map((s, k) => (
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
      )}
    </section>
  );
}

/* ---------------- FEATURED ---------------- */

/**
 * Pick the locale-appropriate metafield value off a Storefront response
 * shaped like `{ <key>_he: { value }, <key>_en: { value } }`. Falls back to
 * the Hebrew value when the English one is empty so the storefront never
 * renders a blank.
 */
function localizedMetafield(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- featured product reference's per-metafield aliases aren't surfaced as a single discriminated type by storefrontapi.generated
  node: any,
  base: string,
  locale: string,
): string {
  const he = node?.[`${base}_he`]?.value;
  const en = node?.[`${base}_en`]?.value;
  return locale === 'en' ? en || he || '' : he || '';
}

type ProductSpecRendered = {
  id: string;
  k: string;
  v: string;
  position: number;
};

function extractProductSpecs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- specs come from a metafield with reference list; concrete inline type isn't generated
  node: any,
  locale: string,
): Array<ProductSpecRendered> {
  const refs: Array<ProductSpecNode> = node?.specs?.references?.nodes ?? [];
  return refs
    .map((spec) => ({
      id: spec.id,
      k:
        locale === 'en'
          ? spec.label_en?.value || spec.label_he?.value || ''
          : spec.label_he?.value || '',
      v:
        locale === 'en'
          ? spec.value_en?.value || spec.value_he?.value || ''
          : spec.value_he?.value || '',
      position: parseInt(spec.position?.value ?? '0', 10) || 0,
    }))
    .sort((a, b) => a.position - b.position);
}

function FeaturedLightboard({
  featuredProduct,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- featured product reference comes via shop.metafield.reference; no single generated fragment captures all aliased metafields
  featuredProduct: any;
}) {
  const {dict, locale} = useI18n();
  const f = dict.featured;
  // Drive the swatch picker from the live Shopify variant data so the merchant
  // can add/rename/recolor variants in admin without a code deploy.
  const colorOption =
    featuredProduct?.options?.find(
      (o: {name: string}) => o.name === 'Color',
    ) ?? null;
  const colorValues: Array<{
    id: string;
    name: string;
    swatch?: {color?: string | null} | null;
  }> = colorOption?.optionValues ?? [];
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colorValues[0]?.name ?? null,
  );
  const productImage = featuredProduct?.featuredImage;
  // All marketing copy comes from product metafields (namespace "marketing")
  // — the merchant edits these in Shopify Admin → Products → Lightboard.
  const eyebrow = localizedMetafield(featuredProduct, 'eyebrow', locale);
  const headlineHtml = localizedMetafield(featuredProduct, 'headline', locale);
  const description = localizedMetafield(featuredProduct, 'description', locale);
  const tagMadeToOrder = localizedMetafield(
    featuredProduct,
    'tagMadeToOrder',
    locale,
  );
  const tagDimensions = featuredProduct?.tagDimensions?.value ?? '';
  const shipNote = localizedMetafield(featuredProduct, 'shipNote', locale);
  const specs = extractProductSpecs(featuredProduct, locale);
  const altText =
    productImage?.altText || featuredProduct?.title || 'Lightboard';
  return (
    <section className="feat3" id="featured">
      <div className="feat3-grid">
        <div className="feat3-stage">
          {productImage ? (
            <Image
              data={productImage}
              alt={altText}
              className="feat3-photo"
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="eager"
            />
          ) : (
            <img
              src="/lightboard-lifestyle.png"
              alt={altText}
              className="feat3-photo"
              loading="eager"
            />
          )}
          <div className="feat3-tags">
            {tagMadeToOrder && (
              <span className="feat3-tag">{tagMadeToOrder}</span>
            )}
            {tagDimensions && (
              <span className="feat3-tag alt">{tagDimensions}</span>
            )}
          </div>
        </div>

        <div className="feat3-rail">
          <Reveal>
            {eyebrow && <div className="feat3-eye">{eyebrow}</div>}
            {headlineHtml && (
              <h2
                className="feat3-title"
                dangerouslySetInnerHTML={{
                  __html: sanitizeShopifyHtml(headlineHtml),
                }}
              />
            )}
            {description && <p className="feat3-desc">{description}</p>}
          </Reveal>

          {specs.length > 0 && (
            <div className="feat3-ticker">
              {specs.map((s) => (
                <div className="feat3-tick" key={s.id}>
                  <span className="k">{s.k}</span>
                  <span className="v">{s.v}</span>
                </div>
              ))}
            </div>
          )}

          {colorValues.length > 1 && (
            <div>
              <div className="feat3-picker-head">
                <span>{f.finishLabel}</span>
                <span className="current">
                  {translateOptionValue(dict, selectedColor ?? '')}
                </span>
              </div>
              <div className="feat3-swatches">
                {colorValues.map((v) => {
                  const hex = v.swatch?.color ?? getOptionValueHex(v.name);
                  const isOn = selectedColor === v.name;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedColor(v.name)}
                      className={`feat3-swatch ${isOn ? 'on' : ''}`}
                      aria-pressed={isOn}
                      type="button"
                    >
                      <span
                        className="dot"
                        style={{background: hex ?? '#999'}}
                        aria-hidden="true"
                      />
                      <span>{translateOptionValue(dict, v.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {featuredProduct ? (
            <BuyBar
              price={featuredProduct.priceRange?.minVariantPrice?.amount}
              currencyCode={
                featuredProduct.priceRange?.minVariantPrice?.currencyCode
              }
              note={shipNote}
              ctaPrimary={f.ctaPrimary}
              handle={featuredProduct.handle}
              variantColor={selectedColor}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

type BuyBarProps = {
  price?: string | null;
  currencyCode?: string | null;
  note?: string;
  ctaPrimary: string;
  handle: string;
  variantColor: string | null;
};

function BuyBar({
  price,
  currencyCode,
  note,
  ctaPrimary,
  handle,
  variantColor,
}: BuyBarProps) {
  const {to} = useI18n();
  const base = to(`/products/${handle}`);
  const href = variantColor
    ? `${base}?Color=${encodeURIComponent(variantColor)}`
    : base;
  const amount = price != null ? Math.round(parseFloat(price)) : null;
  return (
    <div className="feat3-buy">
      {amount != null && (
        <div className="feat3-price">
          <span className="cur">{currencySymbol(currencyCode)}</span>
          <span className="num">{amount}</span>
          <span className="note">{note}</span>
        </div>
      )}
      <div className="feat3-actions">
        <Link to={href} prefetch="intent" className="feat3-cta">
          <span>{ctaPrimary}</span>
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function currencySymbol(code: string | null | undefined): string {
  switch (code) {
    case 'ILS':
      return '₪';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    default:
      return code ?? '';
  }
}

/* ---------------- STORY ---------------- */

function Story({content}: {content: StorySection | null}) {
  // All story copy comes from the `homepage_story` metaobject linked via the
  // `homepage.story` shop metafield. The merchant edits everything (paragraph
  // text, stats, eyebrow, title) from Shopify Admin → Content → Metaobjects.
  if (!content) return null;
  const altText = content.titleLine2 || content.titleLine1 || 'Story';
  return (
    <section className="story" id="story">
      <div className="container">
        <div className="story-grid">
          <div className="story-media">
            {content.tag && <span className="tag">{content.tag}</span>}
            <img
              src={`${STORY_IMAGE}&width=1200`}
              srcSet={[600, 900, 1200, 1600]
                .map((w) => `${STORY_IMAGE}&width=${w} ${w}w`)
                .join(', ')}
              sizes="(min-width: 900px) 50vw, 100vw"
              alt={altText}
              loading="lazy"
            />
          </div>
          <div className="story-copy">
            {content.eyebrow && (
              <Reveal>
                <div className="section-eyebrow" style={{marginBottom: 24}}>
                  <span>{content.eyebrow}</span>
                </div>
              </Reveal>
            )}
            {(content.titleLine1 || content.titleLine2) && (
              <Reveal delay={80}>
                <h2>
                  {content.titleLine1}
                  {content.titleLine1 && content.titleLine2 && <br />}
                  {content.titleLine2 && <em>{content.titleLine2}</em>}
                </h2>
              </Reveal>
            )}
            {(content.p1 || content.p2) && (
              <Reveal delay={160}>
                {content.p1 && <p>{content.p1}</p>}
                {content.p2 && <p>{content.p2}</p>}
              </Reveal>
            )}
            {content.stats?.length > 0 && (
              <div className="story-stats">
                {content.stats.map((st, idx) => (
                  <StoryStat
                    key={st.id}
                    n={st.n}
                    k={st.k}
                    delay={idx * 120}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function Faq({items}: {items: Array<MetaobjectFieldRecord>}) {
  const {dict} = useI18n();
  const f = dict.faq;
  const [open, setOpen] = useState(-1);
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="faq" id="faq">
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
          {items.map((item, idx) => {
            const isOpen = open === idx;
            return (
              <li className={`faq-item${isOpen ? ' open' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : idx)}
                >
                  <span className="faq-q-text">{item.question}</span>
                  <span className="faq-mark" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <div className="faq-a-wrap" aria-hidden={!isOpen}>
                  <div className="faq-a">
                    <p>{item.answer}</p>
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

function Testimonials({items}: {items: Array<MetaobjectFieldRecord>}) {
  const {dict} = useI18n();
  const t = dict.testify;
  const quotes = Array.isArray(items) ? items : [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (quotes.length <= 1) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % quotes.length), 6200);
    return () => clearInterval(id);
  }, [quotes.length]);
  if (quotes.length === 0) return null;
  const q = quotes[i];
  return (
    <section className="testify">
      <div className="container">
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
              «{q.body}»
            </blockquote>
            <div className="attribution">{q.attribution}</div>
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
                key={q.id}
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
    shop {
      featured: metafield(namespace: "custom", key: "featured_product") {
        reference {
          ... on Product {
            id
            title
            handle
            priceRange {
              minVariantPrice { amount currencyCode }
            }
            featuredImage { id url altText width height }
            options {
              id
              name
              optionValues {
                id
                name
                swatch { color }
              }
            }
            eyebrow_he: metafield(namespace: "marketing", key: "eyebrow_he") { value }
            eyebrow_en: metafield(namespace: "marketing", key: "eyebrow_en") { value }
            headline_he: metafield(namespace: "marketing", key: "headline_he") { value }
            headline_en: metafield(namespace: "marketing", key: "headline_en") { value }
            description_he: metafield(namespace: "marketing", key: "description_he") { value }
            description_en: metafield(namespace: "marketing", key: "description_en") { value }
            tagMadeToOrder_he: metafield(namespace: "marketing", key: "tag_made_to_order_he") { value }
            tagMadeToOrder_en: metafield(namespace: "marketing", key: "tag_made_to_order_en") { value }
            tagDimensions: metafield(namespace: "marketing", key: "tag_dimensions") { value }
            shipNote_he: metafield(namespace: "marketing", key: "ship_note_he") { value }
            shipNote_en: metafield(namespace: "marketing", key: "ship_note_en") { value }
            specs: metafield(namespace: "marketing", key: "specs") {
              references(first: 20) {
                nodes {
                  ... on Metaobject {
                    id
                    label_he: field(key: "label_he") { value }
                    label_en: field(key: "label_en") { value }
                    value_he: field(key: "value_he") { value }
                    value_en: field(key: "value_en") { value }
                    position: field(key: "position") { value }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const FAQS_QUERY = `#graphql
  query FAQs {
    metaobjects(type: "faq", first: 20, sortKey: "position") {
      nodes {
        id
        handle
        fields { key value }
      }
    }
  }
`;

const TESTIMONIALS_QUERY = `#graphql
  query Testimonials {
    metaobjects(type: "testimonial", first: 20, sortKey: "position") {
      nodes {
        id
        handle
        fields { key value }
      }
    }
  }
`;

const HERO_SLIDES_QUERY = `#graphql
  query HeroSlides {
    metaobjects(type: "hero_slide", first: 10, sortKey: "position") {
      nodes {
        id
        handle
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url altText width height }
            }
          }
        }
      }
    }
  }
`;

const HOMEPAGE_SECTIONS_QUERY = `#graphql
  query HomepageSections {
    shop {
      hero: metafield(namespace: "homepage", key: "hero") {
        reference {
          ... on Metaobject {
            eyebrow_he: field(key: "eyebrow_he") { value }
            eyebrow_en: field(key: "eyebrow_en") { value }
            title_line_1_he: field(key: "title_line_1_he") { value }
            title_line_1_en: field(key: "title_line_1_en") { value }
            title_line_2_he: field(key: "title_line_2_he") { value }
            title_line_2_en: field(key: "title_line_2_en") { value }
            kicker_he: field(key: "kicker_he") { value }
            kicker_en: field(key: "kicker_en") { value }
            cta_he: field(key: "cta_he") { value }
            cta_en: field(key: "cta_en") { value }
            tape_items_he: field(key: "tape_items_he") { value }
            tape_items_en: field(key: "tape_items_en") { value }
          }
        }
      }
      story: metafield(namespace: "homepage", key: "story") {
        reference {
          ... on Metaobject {
            tag: field(key: "tag") { value }
            eyebrow_he: field(key: "eyebrow_he") { value }
            eyebrow_en: field(key: "eyebrow_en") { value }
            title_line_1_he: field(key: "title_line_1_he") { value }
            title_line_1_en: field(key: "title_line_1_en") { value }
            title_line_2_he: field(key: "title_line_2_he") { value }
            title_line_2_en: field(key: "title_line_2_en") { value }
            p1_he: field(key: "p1_he") { value }
            p1_en: field(key: "p1_en") { value }
            p2_he: field(key: "p2_he") { value }
            p2_en: field(key: "p2_en") { value }
            stats: field(key: "stats") {
              references(first: 10) {
                nodes {
                  ... on Metaobject {
                    id
                    value: field(key: "value") { value }
                    label_he: field(key: "label_he") { value }
                    label_en: field(key: "label_en") { value }
                    position: field(key: "position") { value }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;


export function ErrorBoundary() {
  return <RouteError />;
}
