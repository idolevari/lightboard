import {useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {useI18n} from '~/lib/useI18n';
import {PhotoCustomizer} from './PhotoCustomizer/PhotoCustomizer';

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   requiresPhotos?: boolean;
 *   isEditing?: boolean;
 *   editLineId?: string | null;
 *   initialPhotoState?: {
 *     croppedUrls: string[],
 *     originalUrls: string[],
 *     crops: Array<{x: number, y: number, width: number, height: number}>,
 *   } | null;
 *   cartId?: string | null;
 * }}
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  requiresPhotos = false,
  isEditing = false,
  editLineId = null,
  initialPhotoState = null,
  cartId = null,
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const {dict, to} = useI18n();
  const [photoAttributes, setPhotoAttributes] = useState(
    initialPhotoState && !isEditing
      ? buildAttributesFromInitial(initialPhotoState)
      : null,
  );

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`${to(`/products/${handle}`)}?${variantUriQuery}`}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={`product-options-item${exists && !selected ? ' link' : ''}`}
                      key={option.name + name}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        );
      })}

      {requiresPhotos ? (
        <PhotoCustomizer
          cartId={cartId}
          initialState={initialPhotoState}
          isEditing={isEditing}
          onApprove={(attrs) => {
            setPhotoAttributes(attrs);
            if (isEditing) {
              // Trigger the hidden form submission via state — see UpdateCartForm.
            }
          }}
          onUnapprove={() => setPhotoAttributes(null)}
        />
      ) : null}

      {isEditing && editLineId ? (
        <UpdateCartLineForm
          lineId={editLineId}
          attributes={photoAttributes}
          label={dict.photoCustomizer?.saveAndReturn ?? dict.common.save}
          to={to}
        />
      ) : (
        <AddToCartButton
          disabled={
            !selectedVariant ||
            !selectedVariant.availableForSale ||
            (requiresPhotos && !photoAttributes)
          }
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant,
                    ...(photoAttributes
                      ? {attributes: photoAttributes}
                      : {}),
                  },
                ]
              : []
          }
        >
          {selectedVariant?.availableForSale
            ? dict.product.addToCart
            : dict.product.soldOut}
        </AddToCartButton>
      )}
    </div>
  );
}

/**
 * Submit a CartLinesUpdate when the user finishes editing photos on an
 * existing line. The form auto-submits as soon as `attributes` becomes
 * non-null — the photo customizer flips that state on Approve.
 */
function UpdateCartLineForm({lineId, attributes, label, to}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines: attributes ? [{id: lineId, attributes}] : []}}
    >
      {(fetcher) => (
        <>
          <input type="hidden" name="redirectTo" value={to('/cart')} />
          <button
            type="submit"
            disabled={!attributes || fetcher.state !== 'idle'}
          >
            {label}
          </button>
        </>
      )}
    </CartForm>
  );
}

function buildAttributesFromInitial(initial) {
  return [
    {key: 'Photo 1', value: initial.croppedUrls[0]},
    {key: 'Photo 2', value: initial.croppedUrls[1]},
    {key: 'Photo 3', value: initial.croppedUrls[2]},
  ];
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({swatch, name}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
