import {useLoaderData} from 'react-router';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {canonicalUrl, pageTitle} from '~/lib/meta';
import type {Route} from './+types/($locale).pages.$handle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches helpers in ~/lib/meta accept a narrower MetaMatch type than Route.MetaArgs surfaces
type RouteMatches = any;

export const meta: Route.MetaFunction = ({data, matches}) => {
  const page = data?.page;
  if (!page) return [];
  const title = pageTitle(matches as RouteMatches, page.seo?.title || page.title);
  const description = page.seo?.description || '';
  const tags: Route.MetaDescriptors = [
    {title},
    {tagName: 'link', rel: 'canonical', href: canonicalUrl(matches as RouteMatches, `/pages/${page.handle}`)},
    {property: 'og:title', content: title},
  ];
  if (description) {
    tags.push({name: 'description', content: description});
    tags.push({property: 'og:description', content: description});
  }
  return tags;
};

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

  return {
    page,
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
