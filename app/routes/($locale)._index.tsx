import {Await, Link, useLoaderData} from 'react-router';
import {Suspense, useCallback, useEffect, useState} from 'react';
import type {FocusEvent} from 'react';
import {Image} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {useInView} from '~/lib/useInView';
import {MOTION_EVENT, prefersNoMotion} from '~/lib/motion';
import {getDictionary, detectLocaleFromRequest} from '~/lib/i18n';
import {
  getOptionValueHex,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {metaLocale, routeMeta} from '~/lib/seo-urls';
import {homeSeoCopy} from '~/lib/meta';
import {sanitizeShopifyHtml} from '~/lib/.server/sanitize.server';
import {RouteError} from '~/components/RouteError';
import {AutoLang} from '~/components/AutoLang';
import {
  Doodle,
  LiveLoop,
  StampBadge,
  StringLights,
  SunRays,
  Surfboard,
  Van,
  WaveDivider,
  WaveLayers,
} from '~/components/illustrations';
import type {DoodleName} from '~/components/illustrations';
import {
  PHOTOS,
  SHOPIFY_FILES_CDN,
  cropSrcSet,
  widthSrcSet,
  withParams,
} from '~/lib/photos';
import type {BrandPhoto} from '~/lib/photos';
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
  stats?: {references?: {nodes?: Array<StoryStatNode>} | null} | null;
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
  reference?: {
    image?: {url: string; width?: number | null; height?: number | null} | null;
  } | null;
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
  width: number | null;
  height: number | null;
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
  routeMeta({matches, data, overrides: homeSeoCopy(metaLocale(matches))});

type SimpleMetaobjectQueryResponse = {
  metaobjects?: {nodes?: Array<SimpleMetaobjectNode>} | null;
} | null;

/**
 * Merchant-edited homepage content (hero, story, FAQ, testimonials, slides).
 * Short cache so edits in Shopify Admin show up within about a minute,
 * instead of CacheLong's hour (+ day of stale-while-revalidate).
 */
function merchantContentCache(
  storefront: Route.LoaderArgs['context']['storefront'],
) {
  return storefront.CacheCustom({
    mode: 'public',
    maxAge: 60,
    staleWhileRevalidate: 300,
  });
}

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

/**
 * The featured product's `headline_*` metafields are rendered as HTML.
 * Sanitize them here (server only) so sanitize-html stays out of the client
 * bundle; the component renders the already-clean string.
 */
function sanitizeFeaturedHeadline<
  T extends {
    headline_he?: {value: string} | null;
    headline_en?: {value: string} | null;
  },
>(product: T | null): T | null {
  if (!product) return null;
  const clean = (field: {value: string} | null | undefined) =>
    field ? {...field, value: sanitizeShopifyHtml(field.value)} : field;
  return {
    ...product,
    headline_he: clean(product.headline_he),
    headline_en: clean(product.headline_en),
  };
}

async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const {storefront} = context;
  const [productData, heroData, homepageData] = await Promise.all([
    storefront
      .query(FEATURED_PRODUCT_QUERY, {cache: storefront.CacheShort()})
      .catch((error) => {
        console.error(error);
        return null;
      }),
    storefront
      .query(HERO_SLIDES_QUERY, {
        cache: merchantContentCache(storefront),
      })
      .catch((error) => {
        console.error(error);
        return null;
      }),
    storefront
      .query(HOMEPAGE_SECTIONS_QUERY, {
        cache: merchantContentCache(storefront),
      })
      .catch((error) => {
        console.error(error);
        return null;
      }),
  ]);
  const featuredProduct = sanitizeFeaturedHeadline(
    productData?.shop?.featured?.reference ?? null,
  );
  const {seo: baseSeo, jsonLd} = simpleSeo({
    title: dict.meta.title,
    description: dict.meta.description,
    url: absoluteUrl('/', locale),
  });
  return {
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
    .query(FAQS_QUERY, {
      cache: merchantContentCache(storefront),
    })
    .catch((error: Error) => {
      console.error(error);
      return null;
    });
  const testimonials = storefront
    .query(TESTIMONIALS_QUERY, {
      cache: merchantContentCache(storefront),
    })
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
  const tapeRaw = (node as Record<string, AliasedField>)[
    `tape_items_${locale === 'en' ? 'en' : 'he'}`
  ]?.value;
  const tapeFallback = node.tape_items_he?.value;
  try {
    const parsed: unknown = JSON.parse(tapeRaw ?? tapeFallback ?? '[]');
    tapeItems = Array.isArray(parsed) ? (parsed as Array<string>) : [];
  } catch {
    tapeItems = [];
  }
  return {
    eyebrow: pickField(node as Record<string, AliasedField>, 'eyebrow', locale),
    titleLine1: pickField(
      node as Record<string, AliasedField>,
      'title_line_1',
      locale,
    ),
    titleLine2: pickField(
      node as Record<string, AliasedField>,
      'title_line_2',
      locale,
    ),
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
    titleLine1: pickField(
      node as Record<string, AliasedField>,
      'title_line_1',
      locale,
    ),
    titleLine2: pickField(
      node as Record<string, AliasedField>,
      'title_line_2',
      locale,
    ),
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
      const image = imageField?.reference?.image;
      return {
        id: node.id,
        img: image?.url ?? null,
        width: image?.width ?? null,
        height: image?.height ?? null,
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
      <UspStrip />
      <Story content={data.story} />
      <Suspense fallback={<DeferredSectionFallback />}>
        <Await resolve={data.faqs}>
          {(faqsResponse) => {
            if (!faqsResponse) return null;
            const items = extractMetaobjectFields(
              faqsResponse?.metaobjects?.nodes,
              locale,
              [
                {
                  target: 'question',
                  heKey: 'question_he',
                  enKey: 'question_en',
                },
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
      <FinalCta handle={data.featuredProduct?.handle} />
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

/* ---------------- AUTO-ROTATE ---------------- */

/**
 * Shared carousel timing for the hero and testimonials (WCAG 2.2.2):
 * - never auto-advances under prefers-reduced-motion;
 * - a visible pause/play button (`userPaused`) wins over everything;
 * - pauses while hovered, while keyboard focus is inside, and while the
 *   tab is hidden.
 */
function useAutoRotate(count: number, intervalMs: number) {
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

function MotionToggle({
  stopped,
  onToggle,
  pauseLabel,
  playLabel,
}: {
  stopped: boolean;
  onToggle: () => void;
  pauseLabel: string;
  playLabel: string;
}) {
  return (
    <button
      type="button"
      className="motion-toggle"
      onClick={onToggle}
      aria-label={stopped ? playLabel : pauseLabel}
    >
      {stopped ? (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="2.5" width="3" height="11" fill="currentColor" />
          <rect x="9.5" y="2.5" width="3" height="11" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

/* ---------------- HERO ---------------- */

type HeroSlideForRender = {
  id?: string;
  img: string;
  label?: string;
  /** Source pixel size — lets us request exact CDN crops (no upscaling). */
  w?: number;
  h?: number;
  /** Desktop object-position, e.g. "50% 60%". */
  deskPos?: string;
  /** Horizontal focal point for the portrait phone crop, e.g. "30%". */
  mobilePos?: string;
  /** Optional dedicated portrait photo for phones. */
  mobile?: {img: string; w: number; h: number; pos?: string};
};

const CDN = SHOPIFY_FILES_CDN;

/**
 * Fallback hero rotation, used while no `hero_slide` metaobjects exist
 * (Shopify Admin → Content → Metaobjects wins as soon as entries are added).
 * Warm/cool alternating, ending warm. Photo sources + licences: see
 * `PHOTOS` in app/lib/photos.ts (all Shopify Files, Unsplash License).
 */
const HERO_SLIDES: Array<HeroSlideForRender> = [
  {
    // lightboard-01-van-surfboard-sunset.jpg · Jon Matthews · Unsplash License
    img: PHOTOS.vanSunset.url,
    w: PHOTOS.vanSunset.w,
    h: PHOTOS.vanSunset.h,
    label: 'COAST · LAST LIGHT',
    deskPos: '50% 60%',
    // The bus spans ~60% of the frame, so a 9:16 crop would slice it.
    // Phones get the native-portrait van-bed frame instead
    // (lightboard-03-van-bed-ocean-view.jpg · Jeremy Bishop · Unsplash License).
    mobile: {
      img: PHOTOS.vanBed.url,
      w: PHOTOS.vanBed.w,
      h: PHOTOS.vanBed.h,
      pos: '55%',
    },
  },
  {
    img: `${CDN}/tim-marshall-hIHh4E4_OGA-unsplash.jpg?v=1777138490`,
    w: 3600,
    h: 2400,
    label: 'SURF · OFFSHORE',
  },
  {
    // lightboard-02-golden-hour-wave.jpg · Linus Nylund · Unsplash License
    img: PHOTOS.goldenWave.url,
    w: PHOTOS.goldenWave.w,
    h: PHOTOS.goldenWave.h,
    label: 'SURF · GOLDEN HOUR',
    deskPos: '50% 55%',
    mobilePos: '62%',
  },
  {
    img: `${CDN}/mikail-mcverry-6WRjFofNhPs-unsplash.jpg?v=1777136172`,
    w: 4822,
    h: 3215,
    label: 'VAN LIFE · BEACH PARK',
    mobilePos: '30%',
  },
  {
    // lightboard-04-van-bluff-sunset.jpg · Daniel J. Schwarz · Unsplash License
    img: PHOTOS.vanBluff.url,
    w: PHOTOS.vanBluff.w,
    h: PHOTOS.vanBluff.h,
    label: 'VAN LIFE · CLIFF TOP',
    deskPos: '50% 70%',
    mobilePos: '45%',
  },
];

const HERO_DESKTOP_WIDTHS = [900, 1400, 2000, 2800];
const HERO_MOBILE_WIDTHS = [540, 720, 900, 1080, 1350];

function portrait(
  url: string,
  focalX: string | undefined,
  w?: number,
  h?: number,
) {
  return cropSrcSet(url, {
    ratio: 9 / 16,
    focalX: focalX ?? '50%',
    srcW: w,
    srcH: h,
    widths: HERO_MOBILE_WIDTHS,
  });
}

/** Spread helper: React 18 warns on camelCase `fetchPriority`. */
function fetchPriority(value: 'high' | 'low' | 'auto') {
  return {fetchpriority: value} as Record<string, string>;
}

function HeroPicture({
  slide,
  eager,
}: {
  slide: HeroSlideForRender;
  eager: boolean;
}) {
  const m = slide.mobile;
  return (
    <picture>
      <source
        media="(max-aspect-ratio: 4/5)"
        srcSet={
          m
            ? portrait(m.img, m.pos, m.w, m.h)
            : portrait(slide.img, slide.mobilePos, slide.w, slide.h)
        }
        sizes="100vw"
      />
      <img
        src={withParams(slide.img, 'width=2000')}
        srcSet={widthSrcSet(slide.img, HERO_DESKTOP_WIDTHS, slide.w)}
        // Landscape photo on a viewport narrower than 3:2 is shown at
        // ~150% of the viewport height wide (object-fit: cover).
        sizes="(max-aspect-ratio: 3/2) 150svh, 100vw"
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding={eager ? 'sync' : 'async'}
        {...fetchPriority(eager ? 'high' : 'low')}
        draggable={false}
      />
    </picture>
  );
}

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
            w: s.width ?? undefined,
            h: s.height ?? undefined,
          }))
      : HERO_SLIDES;
  const tape = content?.tape ?? [];
  const rotate = useAutoRotate(activeSlides.length, 5200);
  const i = rotate.index;
  const setI = rotate.setIndex;
  // Only slide 0 is in the server HTML (it is the LCP image). The others
  // are mounted after window load + idle time, or on first interaction, so
  // they never compete with it.
  const [mountAll, setMountAll] = useState(false);
  useEffect(() => {
    if (mountAll) return undefined;
    let idleId: number | undefined;
    let timer: number | undefined;
    const mount = () => {
      const ric = (
        window as Window & {
          requestIdleCallback?: (
            cb: () => void,
            o?: {timeout: number},
          ) => number;
        }
      ).requestIdleCallback;
      if (ric) idleId = ric(() => setMountAll(true), {timeout: 3000});
      else timer = window.setTimeout(() => setMountAll(true), 1500);
    };
    if (document.readyState === 'complete') {
      timer = window.setTimeout(mount, 1200);
    } else {
      window.addEventListener('load', mount, {once: true});
    }
    return () => {
      window.removeEventListener('load', mount);
      if (timer) window.clearTimeout(timer);
      const cic = (
        window as Window & {cancelIdleCallback?: (id: number) => void}
      ).cancelIdleCallback;
      if (idleId && cic) cic(idleId);
    };
  }, [mountAll]);
  useEffect(() => {
    if (i !== 0) setMountAll(true);
  }, [i]);
  // Wave/stamp loops pause while the hero is off-screen.
  const [liveRef, live] = useInView<HTMLElement>({
    once: false,
    threshold: 0,
    rootMargin: '0px',
  });
  const hasVisibleTitle = Boolean(content?.titleLine1 || content?.titleLine2);

  return (
    <section
      ref={liveRef}
      className={`hero${rotate.paused ? ' is-paused' : ''}${rotate.stopped ? ' is-stopped' : ''}${live ? ' is-live' : ''}`}
      aria-label={dict.hero.regionLabel}
      {...rotate.handlers}
    >
      <div className="hero-stage">
        {activeSlides.map(
          (s, j) =>
            (j === 0 || mountAll) && (
              <div
                key={s.id ?? s.img}
                className={`hero-media${j === i ? ' is-active' : ''}`}
                aria-hidden={j !== i}
                style={
                  s.deskPos
                    ? ({'--hero-pos': s.deskPos} as React.CSSProperties)
                    : undefined
                }
              >
                <HeroPicture slide={s} eager={j === 0} />
              </div>
            ),
        )}
      </div>
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-inner">
        {(content?.eyebrow || activeSlides[i]?.label) && (
          <div className="hero-eyebrow">
            <span className="tick" />
            {content?.eyebrow && <span>{content.eyebrow}</span>}
            {content?.eyebrow && activeSlides[i]?.label && (
              <span className="hero-eyebrow-sep">/</span>
            )}
            {activeSlides[i]?.label && (
              <span className="hero-eyebrow-label">
                <AutoLang text={activeSlides[i].label} />
              </span>
            )}
          </div>
        )}
        {/* Exactly one h1 on the homepage: when the merchant clears the
            hero title, keep a visually-hidden one for structure and SEO. */}
        {!hasVisibleTitle && <h1 className="sr-only">{dict.hero.srTitle}</h1>}
        {hasVisibleTitle && (
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
              <span className="arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </a>
          )}
        </div>
        <div
          className="hero-dots"
          role="group"
          aria-label={dict.hero.slideAria}
        >
          {activeSlides.map((s, j) => (
            <button
              key={s.id ?? s.img}
              onClick={() => setI(j)}
              aria-label={`${dict.hero.slideAria} ${j + 1}`}
              aria-current={j === i ? 'true' : undefined}
              className={j === i ? 'on' : ''}
              type="button"
            />
          ))}
          <span className="count" dir="ltr" aria-hidden="true">
            {String(i + 1).padStart(2, '0')} /{' '}
            {String(activeSlides.length).padStart(2, '0')}
          </span>
          {activeSlides.length > 1 && (
            <MotionToggle
              stopped={rotate.stopped}
              onToggle={rotate.toggle}
              pauseLabel={dict.hero.pause}
              playLabel={dict.hero.play}
            />
          )}
        </div>
      </div>

      <div className="hero-stamp" aria-hidden="true">
        <StampBadge />
        {dict.hand?.stamp && (
          <span className="hand-note">{dict.hand.stamp}</span>
        )}
      </div>

      <div className="scroll-hint" aria-hidden="true">
        SCROLL
      </div>

      {tape.length > 0 && (
        <div className="hero-tape" aria-hidden="true">
          <div className="hero-tape-track">
            <span>
              {[...tape, ...tape, ...tape].map((s, k) => (
                // The tape is intentionally tripled for seamless scroll; index
                // is the only stable key since each string repeats three times.
                // eslint-disable-next-line react/no-array-index-key
                <span key={k} className="hero-tape-item">
                  <span>{s}</span>
                  <span className="dot-sep" />
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      <WaveLayers className="hero-waves" />
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
    featuredProduct?.options?.find((o: {name: string}) => o.name === 'Color') ??
    null;
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
  const description = localizedMetafield(
    featuredProduct,
    'description',
    locale,
  );
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
      <LiveLoop className="feat3-lights">
        <StringLights />
      </LiveLoop>
      <div className="feat3-grid">
        <LiveLoop className="feat3-media">
          <div className="feat3-stage">
            {productImage ? (
              <Image
                data={productImage}
                alt={altText}
                className="feat3-photo"
                sizes="(min-width: 980px) 55vw, 100vw"
                loading="lazy"
              />
            ) : (
              <img
                src="/lightboard-lifestyle.jpg"
                alt={altText}
                className="feat3-photo"
                loading="lazy"
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
          <StampBadge className="feat3-stamp" />
        </LiveLoop>

        <div className="feat3-rail">
          <Reveal>
            {eyebrow && <div className="feat3-eye">{eyebrow}</div>}
            {headlineHtml && (
              <h2
                className="feat3-title"
                dangerouslySetInnerHTML={{
                  __html: headlineHtml,
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
          {note && (
            <span className="note">
              <Doodle name="van" size={18} />
              {note}
            </span>
          )}
        </div>
      )}
      <div className="feat3-actions">
        <Link to={href} prefetch="intent" className="feat3-cta">
          <span>{ctaPrimary}</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
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

/* ---------------- USP STRIP ---------------- */

function UspStrip() {
  const {dict} = useI18n();
  const items = (dict.usp?.items ?? []) as Array<{icon: string; label: string}>;
  if (items.length === 0) return null;
  return (
    <section className="usp" aria-label={dict.usp.label}>
      <WaveDivider flip className="band-wave-top" />
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
      <WaveDivider className="section-wave" />
    </section>
  );
}

/* ---------------- STORY ---------------- */

function Story({content}: {content: StorySection | null}) {
  // All story copy comes from the `homepage_story` metaobject linked via the
  // `homepage.story` shop metafield. The merchant edits everything (paragraph
  // text, stats, eyebrow, title) from Shopify Admin → Content → Metaobjects.
  if (!content) return null;
  const main = PHOTOS.vanBed;
  const small = PHOTOS.camperCliff;
  return (
    <section className="story" id="story">
      <LiveLoop className="story-sun">
        <SunRays />
      </LiveLoop>
      <div className="container">
        <div className="story-grid">
          <div className="story-media-wrap">
            <div className="story-media">
              {content.tag && <span className="tag">{content.tag}</span>}
              <img
                src={withParams(main.url, 'width=900')}
                srcSet={cropSrcSet(main.url, {
                  ratio: 4 / 5,
                  focalX: '55%',
                  focalY: '60%',
                  srcW: main.w,
                  srcH: main.h,
                  widths: [480, 720, 960, 1280],
                })}
                sizes="(min-width: 900px) 40vw, 92vw"
                alt=""
                width={1280}
                height={1600}
                loading="lazy"
                decoding="async"
              />
            </div>
            <figure className="story-polaroid" aria-hidden="true">
              <img
                src={withParams(small.url, 'width=480')}
                srcSet={cropSrcSet(small.url, {
                  ratio: 4 / 5,
                  focalX: '45%',
                  focalY: '55%',
                  srcW: small.w,
                  srcH: small.h,
                  widths: [240, 360, 480],
                })}
                sizes="(min-width: 900px) 16vw, 38vw"
                alt=""
                width={480}
                height={600}
                loading="lazy"
                decoding="async"
              />
            </figure>
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
                <Surfboard className="story-board" />
                {content.stats.map((st, idx) => (
                  <StoryStat key={st.id} n={st.n} k={st.k} delay={idx * 120} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <LiveLoop className="story-lights">
        <StringLights />
      </LiveLoop>
      <WaveDivider className="section-wave" />
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
          <Van className="faq-van" />
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

function PhotoBandImage({
  photo,
  focalX,
  className,
}: {
  photo: BrandPhoto;
  focalX: string;
  className: string;
}) {
  return (
    <picture className={className}>
      <source
        media="(max-aspect-ratio: 4/5)"
        srcSet={cropSrcSet(photo.url, {
          ratio: 4 / 5,
          focalX,
          srcW: photo.w,
          srcH: photo.h,
          widths: [480, 720, 960, 1200],
        })}
        sizes="100vw"
      />
      <img
        src={withParams(photo.url, 'width=1200')}
        srcSet={widthSrcSet(photo.url, [720, 1200, 1800, 2400], photo.w)}
        sizes="100vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

function Testimonials({items}: {items: Array<MetaobjectFieldRecord>}) {
  const {dict} = useI18n();
  const t = dict.testify;
  const quotes = Array.isArray(items) ? items : [];
  const rotate = useAutoRotate(quotes.length, 6200);
  const i = Math.min(rotate.index, Math.max(quotes.length - 1, 0));
  const setI = rotate.setIndex;
  if (quotes.length === 0) return null;
  const q = quotes[i];
  return (
    <section
      className="testify testify--band"
      aria-roledescription="carousel"
      aria-label={t.regionLabel}
      {...rotate.handlers}
    >
      <PhotoBandImage
        photo={PHOTOS.surferWalk}
        focalX="60%"
        className="band-photo"
      />
      <WaveDivider flip className="band-wave-top" />
      <div className="container">
        <Reveal>
          <div className="section-eyebrow testify-eyebrow">
            <span>{t.eyebrow}</span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div
            className="testify-stage"
            aria-live={rotate.paused ? 'polite' : 'off'}
          >
            <blockquote key={i} className="testify-quote">
              «{q.body}»
            </blockquote>
            <div className="attribution">{q.attribution}</div>
          </div>
        </Reveal>
        <div className="testify-nav">
          <button
            type="button"
            onClick={() =>
              setI((x: number) => (x - 1 + quotes.length) % quotes.length)
            }
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
                aria-label={t.dotLabel
                  .replace('{n}', String(j + 1))
                  .replace('{total}', String(quotes.length))}
                aria-current={j === i ? 'true' : undefined}
                className={j === i ? 'on' : ''}
                type="button"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setI((x: number) => (x + 1) % quotes.length)}
            aria-label={t.next}
            className="testify-nav-btn"
          >
            →
          </button>
          {quotes.length > 1 && (
            <MotionToggle
              stopped={rotate.stopped}
              onToggle={rotate.toggle}
              pauseLabel={t.pause}
              playLabel={t.play}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */

function FinalCta({handle}: {handle?: string | null}) {
  const {dict, to} = useI18n();
  const c = dict.finalCta;
  if (!c?.title) return null;
  const href = handle ? to(`/products/${handle}`) : '#featured';
  return (
    <section className="final-cta" aria-labelledby="final-cta-title">
      <PhotoBandImage
        photo={PHOTOS.surferDusk}
        focalX="52%"
        className="band-photo"
      />
      <LiveLoop className="final-cta-sun">
        <SunRays />
      </LiveLoop>
      <div className="container final-cta-inner">
        <Reveal>
          <h2 id="final-cta-title" className="final-cta-title">
            {c.title}
          </h2>
        </Reveal>
        <Reveal delay={100}>
          {c.kicker && <p className="final-cta-kicker">{c.kicker}</p>}
          <Link to={href} prefetch="intent" className="hero-cta final-cta-btn">
            <span>{c.cta}</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- QUERIES ---------------- */

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
