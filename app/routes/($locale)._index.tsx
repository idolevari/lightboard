import {Await, useLoaderData} from 'react-router';
import {Suspense} from 'react';
import {getDictionary, detectLocaleFromRequest} from '~/lib/i18n';
import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {toHomeProductCard} from '~/lib/.server/home.server';
import {metaLocale, routeMeta} from '~/lib/seo-urls';
import {homeSeoCopy} from '~/lib/meta';
import {
  extractHeroSection,
  extractHeroSlides,
  extractMetaobjectFields,
  extractStorySection,
} from '~/lib/home/content';
import type {
  HeroSection,
  HeroSlide,
  HomeProductCard,
  SimpleMetaobjectQueryResponse,
  StorySection,
} from '~/lib/home/types';
import {
  FAQS_QUERY,
  FEATURED_PRODUCT_QUERY,
  HERO_SLIDES_QUERY,
  HOME_PRODUCT_BY_HANDLE_QUERY,
  HOMEPAGE_SECTIONS_QUERY,
} from '~/graphql/storefront/HomeQueries';
import {RouteError} from '~/components/RouteError';
import {Hero} from '~/components/home/Hero';
import {
  FeaturedPrintboard,
  FeaturedProduct,
} from '~/components/home/FeaturedProduct';
import {UspStrip} from '~/components/home/UspStrip';
import {Story} from '~/components/home/Story';
import {Faq} from '~/components/home/Faq';
import {FinalCta} from '~/components/home/FinalCta';
import type {Route} from './+types/($locale)._index';

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data, overrides: homeSeoCopy(metaLocale(matches))});

/** Second product block on the homepage, fetched by handle (it's unlisted). */
const HOME_PRINTBOARD_HANDLE = 'printboard';

/**
 * Merchant-edited homepage content (hero, story, FAQ, slides).
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
      featuredProduct: null as HomeProductCard | null,
      printboard: null as HomeProductCard | null,
      faqs: Promise.resolve(
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
  const [productData, printboardData, heroData, homepageData] =
    await Promise.all([
      storefront
        .query(FEATURED_PRODUCT_QUERY, {cache: storefront.CacheShort()})
        .catch((error) => {
          console.error(error);
          return null;
        }),
      // Runs in parallel with the rest; a failure only hides the block.
      storefront
        .query(HOME_PRODUCT_BY_HANDLE_QUERY, {
          cache: merchantContentCache(storefront),
          variables: {handle: HOME_PRINTBOARD_HANDLE},
        })
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
  const featuredReference = productData?.shop?.featured?.reference;
  const featuredProduct = toHomeProductCard(
    featuredReference && 'handle' in featuredReference
      ? featuredReference
      : null,
  );
  const printboardCard = toHomeProductCard(printboardData?.product, {
    lifestyleFirst: true,
  });
  // Never show the same product twice if the merchant features the Printboard.
  const printboard =
    printboardCard && printboardCard.handle !== featuredProduct?.handle
      ? printboardCard
      : null;
  const {seo: baseSeo, jsonLd} = simpleSeo({
    title: dict.meta.title,
    description: dict.meta.description,
    url: absoluteUrl('/', locale),
  });
  return {
    featuredProduct,
    printboard,
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
 * Non-blocking query returned as an unresolved promise so the FAQ
 * section can stream in below the fold instead of holding up
 * first paint. It catches its own error and resolves to `null` so a
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
  return {faqs};
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  const locale = data.locale;
  return (
    <>
      <Hero slides={data.heroSlides} content={data.hero} />
      <FeaturedProduct
        product={data.featuredProduct}
        sectionId="featured"
        ctaLabel={data.dict.featured.ctaPrimary}
      />
      <FeaturedPrintboard product={data.printboard} />
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
      <FinalCta handle={data.featuredProduct?.handle} />
    </>
  );
}

// Empty placeholder while deferred sections stream in. Reserves vertical space
// to avoid CLS but is intentionally minimal — refine visually later if needed.
function DeferredSectionFallback() {
  return <div aria-hidden="true" style={{minHeight: '320px'}} />;
}

export function ErrorBoundary() {
  return <RouteError />;
}
