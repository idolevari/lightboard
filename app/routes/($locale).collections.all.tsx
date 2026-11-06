import {Link, useLoaderData} from 'react-router';
import {getPaginationVariables, Image} from '@shopify/hydrogen';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {Price} from '~/components/ProductPrice';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {absoluteUrl, collectionSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {JsonLd} from '~/components/JsonLd';
import {RouteError} from '~/components/RouteError';
import type {Route} from './+types/($locale).collections.all';

/**
 * Products that must show in the shop even before Storefront lists them.
 * The Printboard is UNLISTED in Shopify for now, so the catalog query
 * doesn't return it; we fetch it by handle and append it on the first page.
 * Once the owner lists it, the catalog includes it and the handle dedupe
 * below makes this a no-op (then this list can be emptied).
 */
const ALWAYS_LISTED_HANDLES = ['printboard'] as const;

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

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
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const firstPage = !new URL(request.url).searchParams.get('cursor');
  const [{products}, ...pinned] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      cache: storefront.CacheShort(),
      variables: {...paginationVariables},
    }),
    ...(firstPage
      ? ALWAYS_LISTED_HANDLES.map((handle) =>
          storefront
            .query(PRODUCT_BY_HANDLE_QUERY, {
              cache: storefront.CacheShort(),
              variables: {handle},
            })
            .catch(() => ({product: null})),
        )
      : []),
  ]);
  const seen = new Set(products.nodes.map((p) => p.handle));
  const extra = pinned
    .map((r) => r.product)
    .filter((p): p is CollectionItemFragment => Boolean(p))
    .filter((p) => !seen.has(p.handle));
  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const {seo, jsonLd} = collectionSeo({
    title: dict.collections.shopTitle,
    description: dict.collections.shopMeta,
    url: absoluteUrl('/collections/all', locale),
  });
  return {
    products: {...products, nodes: [...products.nodes, ...extra]},
    seo,
    jsonLd,
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

export default function Collection() {
  const {products, jsonLd} = useLoaderData<typeof loader>();
  const {dict} = useI18n();

  return (
    <div className="collection shop">
      <JsonLd data={jsonLd} />
      <header className="shop-head">
        <h1>{dict.collections.shopTitle}</h1>
        <p className="shop-intro">{dict.collections.shopIntro}</p>
      </header>
      <PaginatedResourceSection
        connection={products}
        resourcesClassName="shop-grid"
      >
        {({node: product, index}) => (
          <ShopCard
            key={product.id}
            product={product}
            loading={index < 4 ? 'eager' : 'lazy'}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );
}

/** On-brand product card: photo, localized name, short line, price. */
function ShopCard({
  product,
  loading,
}: {
  product: CollectionItemFragment;
  loading: 'eager' | 'lazy';
}) {
  const {dict, to} = useI18n();
  const names = dict.product.names as Record<string, string> | undefined;
  const taglines = dict.product.taglines as Record<string, string> | undefined;
  const name = names?.[product.handle] ?? product.title;
  const tagline = taglines?.[product.handle];
  const image = product.featuredImage;
  return (
    <Link
      className="shop-card"
      prefetch="intent"
      to={to(`/products/${product.handle}`)}
    >
      <div className="shop-card__media">
        {image ? (
          <Image
            alt={image.altText || name}
            aspectRatio="4/5"
            crop="center"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 40vw, 92vw"
          />
        ) : null}
      </div>
      <div className="shop-card__body">
        <h2 className="shop-card__name">{name}</h2>
        {tagline ? <p className="shop-card__tagline">{tagline}</p> : null}
        <div className="shop-card__foot">
          <span className="shop-card__price">
            <Price data={product.priceRange.minVariantPrice} />
          </span>
          <span className="shop-card__cta" aria-hidden="true">
            {dict.collections.shopCta}
          </span>
        </div>
      </div>
    </Link>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
`;

const PRODUCT_BY_HANDLE_QUERY = `#graphql
  query ShopPinnedProduct(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...CollectionItem
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
`;

export function ErrorBoundary() {
  return <RouteError />;
}
