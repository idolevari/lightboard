import {Link, useNavigate} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import type {MappedProductOptions} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {useI18n} from '~/lib/useI18n';
import {
  translateOptionName,
  translateOptionValue,
  getOptionValueHex,
} from '~/lib/productOptionLabels';

/**
 * Variant option swatches for the PDP. Pure UI — no shared state with the
 * customizer/cart pieces, so it can be rendered above the product description
 * while the customize + add-to-cart panel lives further down.
 */
export function ProductOptions({
  productOptions,
}: {
  productOptions: MappedProductOptions[];
}) {
  const navigate = useNavigate();
  const {dict, to} = useI18n();

  return (
    <div className="product-form">
      {productOptions.map((option) => {
        if (option.optionValues.length === 1) return null;

        const selectedValue = option.optionValues.find((v) => v.selected);
        const selectedDisplay = selectedValue
          ? translateOptionValue(dict, selectedValue.name)
          : '';

        return (
          <div className="product-options" key={option.name}>
            <div className="feat3-picker-head">
              <span>{translateOptionName(dict, option.name)}</span>
              {selectedDisplay && (
                <span className="current">{selectedDisplay}</span>
              )}
            </div>
            <div className="feat3-swatches">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;
                const displayName = translateOptionValue(dict, name);
                const hex = swatch?.color ?? getOptionValueHex(name);
                const hasDot = Boolean(hex || swatch?.image?.previewImage?.url);
                const swatchImage = swatch?.image?.previewImage?.url;

                const inner = hasDot ? (
                  <span
                    className="dot"
                    aria-hidden="true"
                    style={{background: hex ?? 'transparent'}}
                  >
                    {swatchImage && <img src={swatchImage} alt="" />}
                  </span>
                ) : (
                  <span aria-hidden="true">{displayName}</span>
                );

                if (isDifferentProduct) {
                  return (
                    <Link
                      className={`feat3-swatch${selected ? ' on' : ''}`}
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`${to(`/products/${handle}`)}?${variantUriQuery}`}
                      aria-pressed={selected}
                      aria-label={displayName}
                      title={displayName}
                    >
                      {inner}
                    </Link>
                  );
                }

                return (
                  <button
                    type="button"
                    className={`feat3-swatch${selected ? ' on' : ''}`}
                    key={option.name + name}
                    disabled={!exists}
                    aria-pressed={selected}
                    aria-label={displayName}
                    title={displayName}
                    onClick={() => {
                      if (!selected) {
                        void navigate(`?${variantUriQuery}`, {
                          replace: true,
                          preventScrollReset: true,
                        });
                      }
                    }}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PhotoAttribute = {key: string; value: string};

type ProductCartActionProps = {
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  requiresPhotos?: boolean;
  isEditing?: boolean;
  editLineId?: string | null;
  photoAttributes?: PhotoAttribute[] | null;
};

/**
 * Cart submission panel. Renders the AddToCart button (or the line-update form
 * when editing an existing cart line). Reads photoAttributes from the parent
 * route because the photo customizer that produces them lives in a separate
 * subtree on the PDP.
 */
export function ProductCartAction({
  selectedVariant,
  requiresPhotos = false,
  isEditing = false,
  editLineId = null,
  photoAttributes = null,
}: ProductCartActionProps) {
  const {open} = useAside();
  const {dict, to} = useI18n();

  if (isEditing && editLineId) {
    return (
      <UpdateCartLineForm
        lineId={editLineId}
        attributes={photoAttributes}
        label={dict.photoCustomizer?.saveAndReturn ?? dict.common.save}
        to={to}
      />
    );
  }

  return (
    <AddToCartButton
      disabled={
        !selectedVariant ||
        !selectedVariant.availableForSale ||
        (requiresPhotos && !photoAttributes)
      }
      onClick={() => open('cart')}
      lines={
        selectedVariant
          ? [
              {
                merchandiseId: selectedVariant.id,
                quantity: 1,
                selectedVariant,
                ...(photoAttributes ? {attributes: photoAttributes} : {}),
              },
            ]
          : []
      }
    >
      {selectedVariant?.availableForSale
        ? dict.product.addToCart
        : dict.product.soldOut}
    </AddToCartButton>
  );
}

/**
 * Submit a CartLinesUpdate when the user finishes editing photos on an
 * existing line. The form auto-submits as soon as `attributes` becomes
 * non-null — the photo customizer flips that state on Approve.
 */
function UpdateCartLineForm({
  lineId,
  attributes,
  label,
  to,
}: {
  lineId: string;
  attributes: PhotoAttribute[] | null;
  label: string;
  to: (path: string) => string;
}) {
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
