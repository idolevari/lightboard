import {useState} from 'react';
import {useLoaderData} from 'react-router';
import {
  getSelectedProductOptions,
  getSeoMeta,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductOptions, ProductCartAction} from '~/components/ProductForm';
import {PhotoCustomizer} from '~/components/PhotoCustomizer/PhotoCustomizer';
import type {PhotoCustomizerInitialState} from '~/components/PhotoCustomizer/PhotoCustomizer';
import {redirectIfHandleIsLocalized} from '~/lib/.server/redirect.server';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {RouteError} from '~/components/RouteError';
import {
  absoluteUrl,
  breadcrumbs,
  productSeo,
  withJsonLd,
} from '~/lib/.server/seo.server';
import type {Route} from './+types/($locale).products.$handle';

const REQUIRES_PHOTOS_TAG = 'requires-photos';

type CartLineAttribute = {key: string; value?: string | null};

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
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront, cart} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const url = new URL(request.url);
  const editLineId = url.searchParams.get('editLineId');

  const [{product}, cartData] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      cache: storefront.CacheShort(),
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    editLineId ? cart.get() : Promise.resolve(null),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const requiresPhotos =
    Array.isArray(product.tags) && product.tags.includes(REQUIRES_PHOTOS_TAG);

  let initialPhotoState: PhotoCustomizerInitialState | null = null;
  let resolvedEditLineId: string | null = null;
  if (editLineId && cartData?.lines?.nodes) {
    const line = cartData.lines.nodes.find(
      (n: {id: string}) => n.id === editLineId,
    );
    if (line) {
      initialPhotoState = parsePhotoStateFromAttributes(line.attributes);
      if (initialPhotoState) resolvedEditLineId = editLineId;
    }
  }

  const locale = detectLocaleFromRequest(request);
  const productUrl = absoluteUrl(`/products/${product.handle}`, locale);
  const variant = product.selectedOrFirstAvailableVariant;
  const productSeoConfig = productSeo({
    title: product.seo?.title || product.title,
    description: product.seo?.description || product.description || '',
    imageUrl: product.featuredImage?.url,
    url: productUrl,
    sku: variant?.sku ?? null,
    vendor: product.vendor ?? null,
    price: variant?.price
      ? {
          amount: variant.price.amount,
          currencyCode: variant.price.currencyCode,
        }
      : null,
    availability: variant?.availableForSale ? 'InStock' : 'OutOfStock',
  });
  const seo = withJsonLd(
    productSeoConfig,
    breadcrumbs([
      {name: 'Lightboard', url: absoluteUrl('/', locale)},
      {name: product.title, url: productUrl},
    ]),
  );

  return {
    product,
    requiresPhotos,
    editLineId: resolvedEditLineId,
    initialPhotoState,
    cartId: cartData?.id ?? null,
    seo,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData() {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

/**
 * Pull the cropped photo URLs off a cart line's attributes. Originals and
 * crop rects are persisted in the buyer's localStorage on approve, so the
 * merchant-visible order line only carries the three Photo URLs.
 */
function buildAttributesFromInitial(initial: PhotoCustomizerInitialState) {
  return [
    {key: 'Photo 1', value: initial.croppedUrls[0]},
    {key: 'Photo 2', value: initial.croppedUrls[1]},
    {key: 'Photo 3', value: initial.croppedUrls[2]},
  ];
}

function parsePhotoStateFromAttributes(
  attributes: Array<CartLineAttribute> | null | undefined,
): PhotoCustomizerInitialState | null {
  if (!Array.isArray(attributes)) return null;
  const map = new Map(attributes.map((a) => [a.key, a.value]));
  const photo1 = map.get('Photo 1');
  const photo2 = map.get('Photo 2');
  const photo3 = map.get('Photo 3');
  if (!photo1 || !photo2 || !photo3) return null;
  return {
    croppedUrls: [photo1, photo2, photo3],
    originalUrls: [null, null, null],
    crops: [null, null, null],
  };
}

export default function Product() {
  const {
    product,
    requiresPhotos,
    editLineId,
    initialPhotoState,
    cartId,
  } = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url.
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const isEditing = Boolean(editLineId && initialPhotoState);
  const [photoAttributes, setPhotoAttributes] = useState(
    initialPhotoState && !isEditing
      ? buildAttributesFromInitial(initialPhotoState)
      : null,
  );

  return (
    <div className="product">
      {requiresPhotos ? (
        <PhotoCustomizer
          cartId={cartId}
          initialState={initialPhotoState}
          isEditing={isEditing}
          onApprove={setPhotoAttributes}
          onUnapprove={() => setPhotoAttributes(null)}
        />
      ) : null}
      <div className="product-main">
        <h1>{title}</h1>
        <ProductPrice
          price={selectedVariant?.price}
          compareAtPrice={selectedVariant?.compareAtPrice}
        />
        {descriptionHtml ? (
          <div
            className="product-description"
            dangerouslySetInnerHTML={{__html: sanitizeShopifyHtml(descriptionHtml)}}
          />
        ) : null}
        <ProductOptions productOptions={productOptions} />
        <ProductCartAction
          selectedVariant={selectedVariant}
          requiresPhotos={requiresPhotos}
          isEditing={isEditing}
          editLineId={editLineId}
          photoAttributes={photoAttributes}
        />
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    tags
    featuredImage {
      url
      altText
      width
      height
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export function ErrorBoundary() {
  return <RouteError />;
}
