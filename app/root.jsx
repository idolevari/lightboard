import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import {PageLayout} from './components/PageLayout';
import {ComingSoon} from './components/ComingSoon';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectLocaleFromRequest,
  getDictionary,
  getLocaleConfig,
  localizedPath,
  parseLocaleFromPath,
} from '~/lib/i18n';

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 * @type {ShouldRevalidateFunction}
 */
export const shouldRevalidate = ({formMethod, currentUrl, nextUrl}) => {
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

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  const {storefront, env} = args.context;
  const showComingSoon = env.COMING_SOON === 'true';

  const locale = detectLocaleFromRequest(args.request);
  const dict = getDictionary(locale);
  const localeConfig = getLocaleConfig(locale);
  const url = new URL(args.request.url);
  const {rest: pathnameNoLocale} = parseLocaleFromPath(url.pathname);

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {
    ...deferredData,
    ...criticalData,
    showComingSoon,
    locale,
    localeConfig,
    dict,
    pathnameNoLocale,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
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

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context}) {
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
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error) => {
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

/**
 * @param {{children?: React.ReactNode}}
 */
export function Layout({children}) {
  const nonce = useNonce();
  const data = useRouteLoaderData('root');
  const locale = data?.locale ?? DEFAULT_LOCALE;
  const config = data?.localeConfig ?? getLocaleConfig(locale);
  const pathnameNoLocale = data?.pathnameNoLocale ?? '/';

  return (
    <html lang={config.htmlLang} dir={config.dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        {SUPPORTED_LOCALES.map((l) => (
          <link
            key={l}
            rel="alternate"
            hrefLang={getLocaleConfig(l).htmlLang}
            href={localizedPath(pathnameNoLocale, l)}
          />
        ))}
        <link
          rel="alternate"
          hrefLang="x-default"
          href={localizedPath(pathnameNoLocale, DEFAULT_LOCALE)}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  /** @type {RootLoader} */
  const data = useRouteLoaderData('root');

  if (!data) {
    return <Outlet />;
  }

  if (data.showComingSoon) {
    return <ComingSoon />;
  }

  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PageLayout {...data}>
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData('root');
  const dict = data?.dict ?? getDictionary(DEFAULT_LOCALE);
  const locale = data?.locale ?? DEFAULT_LOCALE;
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const homeHref = locale === DEFAULT_LOCALE ? '/' : `/${locale}`;
  const isNotFound = errorStatus === 404;

  return (
    <div className="route-error" style={{padding: '160px 24px 80px', maxWidth: 720, margin: '0 auto', textAlign: 'center'}}>
      <p
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 24,
        }}
      >
        {errorStatus}
      </p>
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 300,
          fontSize: 'clamp(40px, 6vw, 80px)',
          lineHeight: 1,
          letterSpacing: '-0.03em',
          margin: '0 0 16px',
        }}
      >
        {isNotFound ? dict.notFound.title : 'Oops'}
      </h1>
      {isNotFound && <p style={{color: 'var(--ink-soft)', marginBottom: 32}}>{dict.notFound.kicker}</p>}
      <a
        href={homeHref}
        className="hero-cta"
        style={{display: 'inline-flex', background: 'var(--ink)', color: 'var(--white)'}}
      >
        <span>{dict.notFound.cta}</span>
        <span className="arrow" aria-hidden="true">→</span>
      </a>
      {!isNotFound && errorMessage && (
        <fieldset style={{marginTop: 40, textAlign: 'start'}}>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}

/** @typedef {LoaderReturnData} RootLoader */

/** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */
/** @typedef {import('./+types/root').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
