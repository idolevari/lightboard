import {useLoaderData} from 'react-router';
import {getSeoMeta} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/.server/redirect.server';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {RouteError} from '~/components/RouteError';
import type {Route} from './+types/($locale).pages.$handle';

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo as Parameters<typeof getSeoMeta>[0], data?.seo as Parameters<typeof getSeoMeta>[0]) ?? [];

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData();

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const [{page}] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      cache: context.storefront.CacheLong(),
      variables: {
        handle: params.handle,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  const locale = detectLocaleFromRequest(request);
  const seo = simpleSeo({
    title: page.seo?.title || page.title,
    description: page.seo?.description || undefined,
    url: absoluteUrl(`/pages/${page.handle}`, locale),
  });

  return {
    page,
    seo,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData() {
  return {};
}

export default function Page() {
  const {page} = useLoaderData<typeof loader>();

  return (
    <article className="page">
      <div
        className="page-body"
        dangerouslySetInnerHTML={{__html: sanitizeShopifyHtml(page.body)}}
      />
    </article>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
`;

export function ErrorBoundary() {
  return <RouteError />;
}
