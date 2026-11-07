import {useRef, useState} from 'react';
import {useLoaderData} from 'react-router';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {
  getOptionValueHex,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import {ProductOptions, ProductCartAction} from '~/components/ProductForm';
import {PhotoCustomizer} from '~/components/PhotoCustomizer/PhotoCustomizer';
import {StickyBuyBar} from '~/components/StickyBuyBar';
import {ProductHead} from '~/components/product/ProductHead';
import {ProductSpecs} from '~/components/product/ProductSpecs';
import {InYourHome, PrintboardOnTheWall} from '~/components/product/InYourHome';
import type {PhotoCustomizerInitialState} from '~/components/PhotoCustomizer/PhotoCustomizer';
import {redirectIfHandleIsLocalized} from '~/lib/.server/redirect.server';
import {checkForTrailingEncodedSpaces} from '~/lib/.server/url.server';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {sanitizeShopifyHtml} from '~/lib/.server/sanitize.server';
import {grantPhotoUploads} from '~/lib/.server/photo-upload.server';
import {JsonLd} from '~/components/JsonLd';
import {RouteError} from '~/components/RouteError';
import {absoluteUrl, productSeo} from '~/lib/.server/seo.server';
import {metaLocale, routeMeta} from '~/lib/seo-urls';
import {productSeoCopy} from '~/lib/meta';
import {
  CUSTOMIZER_CONFIG,
  LINE_ATTR,
  PRINTBOARD_SIZE_LABEL,
  customizerKindForTags,
} from '~/lib/customizer-config';
import type {CustomizerKind} from '~/lib/customizer-config';
import type {Route} from './+types/($locale).products.$handle';

const CUSTOMIZER_ID = 'customizer';

type CartLineAttribute = {key: string; value?: string | null};

export const meta: Route.MetaFunction = ({data, matches}) => {
  const product = data?.product;
  if (!product) return routeMeta({matches, data});
  const price = product.selectedOrFirstAvailableVariant?.price;
  return routeMeta({
    matches,
    data,
    overrides: productSeoCopy(
      product,
      price,
      metaLocale(matches),
      data.customizerKind,
    ),
    ogType: 'product',
    extra: price
      ? [
          {property: 'product:price:amount', content: price.amount},
          {property: 'product:price:currency', content: price.currencyCode},
        ]
      : [],
  });
};

export async function loader(args: Route.LoaderArgs) {
  const redirectResponse = checkForTrailingEncodedSpaces(args.request);
  if (redirectResponse) throw redirectResponse;

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

  // `requires-photos` → Lightboard customizer, `requires-print-photo` →
  // Printboard customizer (see ~/lib/customizer-config).
  const customizerKind = customizerKindForTags(product.tags);
  const requiresPhotos = Boolean(customizerKind);
  // Signed-session proof that this visitor rendered a photo product page;
  // /api/photos/upload rejects requests without it.
  if (requiresPhotos) grantPhotoUploads(context.session);

  let initialPhotoState: PhotoCustomizerInitialState | null = null;
  let resolvedEditLineId: string | null = null;
  if (editLineId && cartData?.lines?.nodes) {
    const line = cartData.lines.nodes.find(
      (n: {id: string}) => n.id === editLineId,
    );
    if (line) {
      initialPhotoState = parsePhotoStateFromAttributes(
        line.attributes,
        customizerKind,
      );
      if (initialPhotoState) resolvedEditLineId = editLineId;
    }
  }

  const locale = detectLocaleFromRequest(request);
  const productUrl = absoluteUrl(`/products/${product.handle}`, locale);
  const variant = product.selectedOrFirstAvailableVariant;
  const {seo, jsonLd} = productSeo({
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
    breadcrumb: [
      {name: 'Lightboard', url: absoluteUrl('/', locale)},
      {name: product.title, url: productUrl},
    ],
  });

  return {
    product: {
      ...product,
      descriptionHtml: sanitizeShopifyHtml(product.descriptionHtml),
    },
    marketing: extractMarketing(product, locale),
    requiresPhotos,
    customizerKind,
    editLineId: resolvedEditLineId,
    initialPhotoState,
    cartId: cartData?.id ?? null,
    seo,
    jsonLd,
  };
}

type MetafieldValue = {value?: string | null} | null | undefined;

type MarketingSpec = {
  id: string;
  label: string;
  value: string;
  position: number;
};

type MarketingSource = {
  eyebrow_he?: MetafieldValue;
  eyebrow_en?: MetafieldValue;
  headline_he?: MetafieldValue;
  headline_en?: MetafieldValue;
  ship_note_he?: MetafieldValue;
  ship_note_en?: MetafieldValue;
  specs?: {
    references?: {
      nodes?: Array<{
        id?: string;
        label_he?: MetafieldValue;
        label_en?: MetafieldValue;
        value_he?: MetafieldValue;
        value_en?: MetafieldValue;
        position?: MetafieldValue;
      }>;
    } | null;
  } | null;
  images?: {
    nodes?: Array<{
      id?: string | null;
      url: string;
      altText?: string | null;
      width?: number | null;
      height?: number | null;
    }>;
  } | null;
  options?: Array<{
    optionValues?: Array<{
      firstSelectableVariant?: {
        image?: {url?: string | null; altText?: string | null} | null;
      } | null;
    }>;
  }>;
};

/** Hebrew is canonical; English falls back to it so nothing renders blank. */
function pick(he: MetafieldValue, en: MetafieldValue, locale: string): string {
  return locale === 'en' ? en?.value || he?.value || '' : he?.value || '';
}

/**
 * Merchant-edited PDP copy from the product's `marketing.*` metafields
 * (Shopify Admin → Products → Lightboard). The headline is HTML, so it is
 * sanitized here on the server like every other Shopify HTML field.
 * `lifestyle` / `lifestyleSecond` = the first two product images that aren't
 * variant renders, i.e. the "on a real wall" shots (order set in Shopify).
 */
function extractMarketing(product: MarketingSource, locale: string) {
  const headline = pick(product.headline_he, product.headline_en, locale);
  const specs: Array<MarketingSpec> = (product.specs?.references?.nodes ?? [])
    .map((n, i) => ({
      id: n.id ?? String(i),
      label: pick(n.label_he, n.label_en, locale),
      value: pick(n.value_he, n.value_en, locale),
      position: parseInt(n.position?.value ?? '0', 10) || 0,
    }))
    .filter((n) => n.label && n.value)
    .sort((a, b) => a.position - b.position);
  // Variant renders are matched by URL, and by alt text too: re-uploaded
  // copies of a render get a new URL but keep the same alt text.
  const variantImages = (product.options ?? []).flatMap((o) =>
    (o.optionValues ?? []).map((v) => v.firstSelectableVariant?.image),
  );
  const variantUrls = new Set(
    variantImages.map((im) => im?.url?.split('?')[0]).filter(Boolean),
  );
  const variantAlts = new Set(
    variantImages.map((im) => im?.altText?.trim()).filter(Boolean),
  );
  const lifestyleImages = (product.images?.nodes ?? []).filter(
    (img) =>
      !variantUrls.has(img.url.split('?')[0]) &&
      !(img.altText && variantAlts.has(img.altText.trim())),
  );
  return {
    eyebrow: pick(product.eyebrow_he, product.eyebrow_en, locale),
    headlineHtml: headline ? sanitizeShopifyHtml(headline) : '',
    shipNote: pick(product.ship_note_he, product.ship_note_en, locale),
    specs,
    lifestyle: lifestyleImages[0] ?? null,
    lifestyleSecond: lifestyleImages[1] ?? null,
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
 * Pull the cropped photo URLs off a cart line's attributes. For the
 * Lightboard, originals and crop rects are persisted in the buyer's
 * localStorage on approve, so the merchant-visible order line only carries
 * the three Photo URLs. A Printboard line also carries its original photo or
 * its ready-made design id.
 */
function buildAttributesFromInitial(initial: PhotoCustomizerInitialState) {
  return initial.croppedUrls.map((value, i) => ({
    key: LINE_ATTR.photo(i + 1),
    value,
  }));
}

function parsePhotoStateFromAttributes(
  attributes: Array<CartLineAttribute> | null | undefined,
  kind: CustomizerKind | null,
): PhotoCustomizerInitialState | null {
  if (!kind || !Array.isArray(attributes)) return null;
  const {slotCount} = CUSTOMIZER_CONFIG[kind];
  const map = new Map(attributes.map((a) => [a.key, a.value]));
  const croppedUrls = Array.from(
    {length: slotCount},
    (_, i) => map.get(LINE_ATTR.photo(i + 1)) ?? '',
  );
  if (croppedUrls.some((u) => !u)) return null;
  const isPrint = kind === 'printboard';
  return {
    croppedUrls,
    originalUrls: croppedUrls.map((_, i) =>
      isPrint && i === 0 ? (map.get(LINE_ATTR.original) ?? null) : null,
    ),
    crops: croppedUrls.map(() => null),
    presetIds: croppedUrls.map((_, i) =>
      isPrint && i === 0 ? (map.get(LINE_ATTR.designId) ?? null) : null,
    ),
  };
}

export default function Product() {
  const {
    product,
    marketing,
    requiresPhotos,
    customizerKind,
    editLineId,
    initialPhotoState,
    cartId,
    jsonLd,
  } = useLoaderData<typeof loader>();
  const isPrint = customizerKind === 'printboard';
  const slotCount = customizerKind
    ? CUSTOMIZER_CONFIG[customizerKind].slotCount
    : 0;

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

  const {dict} = useI18n();
  const [photosFilled, setPhotosFilled] = useState(
    initialPhotoState ? slotCount : 0,
  );
  const buyRef = useRef<HTMLDivElement>(null);
  const colorValue =
    selectedVariant?.selectedOptions.find((o) => o.name === 'Color')?.value ??
    null;
  const colorSwatch = product.options
    .find((o) => o.name === 'Color')
    ?.optionValues.find((v) => v.name === colorValue)?.swatch;
  const colorHex = colorValue
    ? (colorSwatch?.color ?? getOptionValueHex(colorValue) ?? null)
    : null;
  const ready = !requiresPhotos || Boolean(photoAttributes);
  // All photos are in but not approved yet: the customizer's own "approve"
  // button is the one action, so the add-to-cart block steps aside.
  const awaitingApproval =
    requiresPhotos &&
    !isEditing &&
    !photoAttributes &&
    photosFilled >= slotCount;
  const available = Boolean(selectedVariant?.availableForSale);
  // Specs: the product's `marketing.specs` metaobjects when set in Shopify,
  // else (Printboard) the i18n fallback.
  const specs =
    marketing.specs.length > 0 || !isPrint
      ? marketing.specs
      : (
          (dict.printboard?.specs ?? []) as Array<{
            label: string;
            value: string;
          }>
        ).map((spec, i) => ({
          id: `pb-spec-${i}`,
          label: spec.label,
          value: spec.value.replace('{size}', PRINTBOARD_SIZE_LABEL),
        }));

  // ATC tapped while photos are missing: bring the customizer into view and
  // put focus on the first empty slot so the next action is obvious.
  function goToCustomizer() {
    const root = document.getElementById(CUSTOMIZER_ID);
    if (!root) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    root.scrollIntoView({block: 'start', behavior: reduce ? 'auto' : 'smooth'});
    const target =
      root.querySelector<HTMLElement>('.board-slots__pick:not([disabled])') ??
      root.querySelector<HTMLElement>('.pb-own__btn:not([disabled])') ??
      root.querySelector<HTMLElement>(
        '.photo-customizer__approve:not([disabled])',
      );
    target?.focus({preventScroll: true});
    root.classList.remove('is-pulsing');
    // Restart the attention pulse on the slot strip.
    void root.offsetWidth;
    root.classList.add('is-pulsing');
  }

  // Mobile reading order (and DOM / heading order): name + price → color →
  // live preview + photo slots → add to cart → details. On desktop the
  // customizer moves into the left column via grid areas (product/pdp.css).
  return (
    <div className="product">
      <JsonLd data={jsonLd} />
      <ProductHead
        headlineHtml={marketing.headlineHtml}
        title={title}
        isPrint={isPrint}
        price={selectedVariant?.price}
        compareAtPrice={selectedVariant?.compareAtPrice}
      />
      <div className="product-variant">
        <ProductOptions productOptions={productOptions} />
      </div>
      {requiresPhotos ? (
        <div className="product-media" id={CUSTOMIZER_ID}>
          <PhotoCustomizer
            kind={customizerKind ?? 'lightboard'}
            cartId={cartId}
            initialState={initialPhotoState}
            isEditing={isEditing}
            imageUrl={selectedVariant?.image?.url ?? null}
            imageAlt={[title, translateOptionValue(dict, colorValue ?? '')]
              .filter(Boolean)
              .join(' – ')}
            color={colorValue}
            onApprove={setPhotoAttributes}
            onUnapprove={() => setPhotoAttributes(null)}
            onProgressChange={setPhotosFilled}
          />
        </div>
      ) : null}
      <div
        className={`product-buy${awaitingApproval ? ' is-awaiting-approval' : ''}`}
        ref={buyRef}
      >
        <ProductCartAction
          selectedVariant={selectedVariant}
          requiresPhotos={requiresPhotos}
          isEditing={isEditing}
          editLineId={editLineId}
          photoAttributes={photoAttributes}
          photosFilled={photosFilled}
          slotCount={slotCount}
          kind={customizerKind}
          onNeedPhotos={goToCustomizer}
        />
      </div>
      <ProductSpecs specs={specs} />
      {descriptionHtml ? (
        <div
          className="product-description"
          dangerouslySetInnerHTML={{__html: descriptionHtml}}
        />
      ) : null}
      {isPrint ? (
        <PrintboardOnTheWall images={product.images.nodes} />
      ) : (
        <InYourHome
          lifestyle={marketing.lifestyle}
          second={marketing.lifestyleSecond}
        />
      )}
      {!isEditing ? (
        <StickyBuyBar
          buyRef={buyRef}
          price={selectedVariant?.price}
          colorHex={colorHex}
          colorName={
            colorValue ? translateOptionValue(dict, colorValue) : undefined
          }
          ready={ready}
          available={available}
          pendingLabel={
            isPrint
              ? photosFilled > 0
                ? dict.printboard?.approve
                : dict.printboard?.chooseDesign
              : undefined
          }
        />
      ) : null}
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
    images(first: 12) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    eyebrow_he: metafield(namespace: "marketing", key: "eyebrow_he") { value }
    eyebrow_en: metafield(namespace: "marketing", key: "eyebrow_en") { value }
    headline_he: metafield(namespace: "marketing", key: "headline_he") { value }
    headline_en: metafield(namespace: "marketing", key: "headline_en") { value }
    ship_note_he: metafield(namespace: "marketing", key: "ship_note_he") { value }
    ship_note_en: metafield(namespace: "marketing", key: "ship_note_en") { value }
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
