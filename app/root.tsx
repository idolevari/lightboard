import type {ReactNode} from 'react';
import {
  Analytics,
  getShopAnalytics,
  useCustomerPrivacy,
  useNonce,
} from '@shopify/hydrogen';
import {
  Outlet,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type {ShouldRevalidateFunction} from 'react-router';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import {PageLayout} from './components/PageLayout';
import {ComingSoon} from './components/ComingSoon';
import {JsonLd} from './components/JsonLd';
import {RouteError} from './components/RouteError';
import {
  DEFAULT_LOCALE,
  detectLocaleFromRequest,
  getDictionary,
  getLocaleConfig,
  parseLocaleFromPath,
} from '~/lib/i18n';
import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {rootSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {MetaPixel, MetaPixelScript} from '~/lib/meta-pixel';
import type {Route} from './+types/root';

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Revalidate on locale change so the dict, html lang/dir, and active-locale
  // chrome update in a single navigation (otherwise switching languages
  // requires two clicks — first updates URL, second refreshes root data).
  const currentLocale = parseLocaleFromPath(currentUrl.pathname).locale;
  const nextLocale = parseLocaleFromPath(nextUrl.pathname).locale;
  if (currentLocale !== nextLocale) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,0..100,0..1;1,9..144,300..700,0..100,0..1&family=Frank+Ruhl+Libre:wght@300..900&family=Heebo:wght@300;400;500;700;800&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400..700&display=swap',
    },
    {rel: 'icon', type: 'image/png', href: '/favicon.png'},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  const {env} = args.context;
  const locale = detectLocaleFromRequest(args.request);
  const dict = getDictionary(locale);
  const localeConfig = getLocaleConfig(locale);
  const url = new URL(args.request.url);
  const {rest: pathnameNoLocale} = parseLocaleFromPath(url.pathname);

  const {seo, jsonLd} = rootSeo({
    locale,
    pathnameNoLocale,
    title: dict.meta.title,
    description: dict.meta.description,
  });

  // When the launch gate is active we render <ComingSoon /> only — no
  // header/footer/cart/shop/consent data leaves the server. Child route
  // loaders are also blocked by the locale layout gate.
  if (isLaunchGateActive(args.request, env)) {
    return {
      showComingSoon: true as const,
      locale,
      localeConfig,
      dict,
      pathnameNoLocale,
      seo,
      jsonLd,
    };
  }

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {
    ...deferredData,
    ...criticalData,
    showComingSoon: false as const,
    locale,
    localeConfig,
    dict,
    pathnameNoLocale,
    seo,
    jsonLd,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    metaPixelId: env.META_PIXEL_ID || null,
    shop: getShopAnalytics({
      storefront: args.context.storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {header};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: unknown) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export type RootLoader = typeof loader;

type LayoutProps = {children?: ReactNode};

export function Layout({children}: LayoutProps) {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>('root');
  const locale = data?.locale ?? DEFAULT_LOCALE;
  const config = data?.localeConfig ?? getLocaleConfig(locale);

  return (
    <html lang={config.htmlLang} dir={config.dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <Meta />
        <Links />
        <MetaPixelScript
          pixelId={data && !data.showComingSoon ? data.metaPixelId : null}
          nonce={nonce}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

type PrivacyGateProps = {
  checkoutDomain: string;
  storefrontAccessToken: string;
};

/**
 * Mounts Shopify's Customer Privacy API and registers a dev-only callback
 * for visitor consent collection. Returns null — its only job is to fire
 * the side effect of loading the consent-tracking script and wiring the
 * `visitorConsentCollected` event listener so other components (e.g.
 * <MetaPixel />) can read consent state.
 *
 * Note: <Analytics.Provider> internally also calls useCustomerPrivacy,
 * but the script loader dedupes by element id ("customer-privacy-api"),
 * so the script only loads once. Calling the hook again here gives us a
 * place to add custom consent-related side effects without forking the
 * Provider.
 */
function PrivacyGate({checkoutDomain, storefrontAccessToken}: PrivacyGateProps) {
  useCustomerPrivacy({
    checkoutDomain,
    storefrontAccessToken,
    onVisitorConsentCollected: (consent) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[customer-privacy] consent collected', consent);
      }
    },
  });
  return null;
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  if (data.showComingSoon) {
    return (
      <>
        <JsonLd data={data.jsonLd} />
        <ComingSoon />
      </>
    );
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PrivacyGate
        checkoutDomain={data.consent.checkoutDomain}
        storefrontAccessToken={data.consent.storefrontAccessToken}
      />
      <MetaPixel pixelId={data.metaPixelId ?? null} />
      <JsonLd data={data.jsonLd} />
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  return <RouteError />;
}
