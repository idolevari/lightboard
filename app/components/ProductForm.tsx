import {useEffect, useId, useRef} from 'react';
import {Link, useNavigate} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import type {MappedProductOptions} from '@shopify/hydrogen';
import type {ProductFragment} from 'storefrontapi.generated';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {useI18n} from '~/lib/useI18n';
import {formatMoney} from './ProductPrice';
import type {CustomizerKind} from '~/lib/customizer-config';
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

        const headId = `option-${option.name.replace(/\W+/g, '-')}`;
        return (
          <div className="product-options" key={option.name}>
            <div className="feat3-picker-head" id={headId}>
              <span>{translateOptionName(dict, option.name)}</span>
            </div>
            <div
              className="feat3-swatches"
              role="radiogroup"
              aria-labelledby={headId}
            >
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

                // Same labelled pill as the homepage picker: dot + name, so
                // the pale cream swatch is never just a near-invisible dot.
                const inner = (
                  <>
                    {hasDot ? (
                      <span
                        className="dot"
                        aria-hidden="true"
                        style={{background: hex ?? 'transparent'}}
                      >
                        {swatchImage && <img src={swatchImage} alt="" />}
                      </span>
                    ) : null}
                    <span>{displayName}</span>
                  </>
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
                      role="radio"
                      aria-checked={selected}
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
                    role="radio"
                    aria-checked={selected}
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
  /** How many of the photo slots are filled (customizer progress). */
  photosFilled?: number;
  /** Photo slots the product needs (Lightboard 3, Printboard 1). */
  slotCount?: number;
  kind?: CustomizerKind | null;
  /** Scroll/focus the customizer — used while photos are still missing. */
  onNeedPhotos?: () => void;
};

export const PHOTO_SLOTS = 3;

/**
 * Cart submission panel.
 *
 * Never shows a dead primary CTA: while the photos aren't ready the button
 * says what's missing ("בחרו עוד 2 תמונות כדי להמשיך"), stays tappable and
 * takes the shopper to the customizer. Once the photos are approved it
 * becomes "הוספה לסל · 279 ₪" and receives focus so the next step is
 * on-screen without hunting for it.
 */
export function ProductCartAction({
  selectedVariant,
  requiresPhotos = false,
  isEditing = false,
  editLineId = null,
  photoAttributes = null,
  photosFilled = 0,
  slotCount = PHOTO_SLOTS,
  kind = null,
  onNeedPhotos,
}: ProductCartActionProps) {
  const {open} = useAside();
  const {dict, to, locale} = useI18n();
  const t = dict.photoCustomizer;
  const hintId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const ready = !requiresPhotos || Boolean(photoAttributes);

  // Photos just got approved → bring the CTA into view and focus it.
  const prevReady = useRef(ready);
  useEffect(() => {
    if (ready && !prevReady.current && buttonRef.current) {
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      buttonRef.current.scrollIntoView({
        block: 'center',
        behavior: reduce ? 'auto' : 'smooth',
      });
      buttonRef.current.focus({preventScroll: true});
    }
    prevReady.current = ready;
  }, [ready]);

  if (isEditing && editLineId) {
    return (
      <UpdateCartLineForm
        lineId={editLineId}
        attributes={photoAttributes}
        label={t?.saveAndReturn ?? dict.common.save}
        to={to}
      />
    );
  }

  const available = Boolean(selectedVariant?.availableForSale);
  const priceText = formatMoney(selectedVariant?.price, locale);

  if (available && !ready && kind === 'printboard') {
    // One photo: no "n of 3" counter, just what to do next.
    const pt = dict.printboard;
    return (
      <div className="atc">
        <button
          ref={buttonRef}
          type="button"
          className="atc-btn atc-btn--pending"
          aria-describedby={hintId}
          onClick={onNeedPhotos}
        >
          <span>{photosFilled > 0 ? pt.needApprove : pt.needDesign}</span>
        </button>
        <p id={hintId} className="atc-hint">
          {pt.hint}
        </p>
      </div>
    );
  }

  if (available && !ready) {
    const missing = Math.max(0, slotCount - photosFilled);
    const label =
      missing === 0
        ? t.needApprove
        : missing === 1
          ? t.needOnePhoto
          : t.needPhotos.replace('{n}', String(missing));
    return (
      <div className="atc">
        <button
          ref={buttonRef}
          type="button"
          className="atc-btn atc-btn--pending"
          aria-describedby={hintId}
          onClick={onNeedPhotos}
        >
          <span>{label}</span>
        </button>
        <p id={hintId} className="atc-hint">
          <span className="atc-progress" aria-hidden="true">
            {Array.from({length: slotCount}, (_, i) => (
              <span key={i} className={i < photosFilled ? 'on' : ''} />
            ))}
          </span>
          {t.progress.replace('{n}', String(photosFilled))}
        </p>
      </div>
    );
  }

  return (
    <div className="atc">
      <AddToCartButton
        buttonRef={buttonRef}
        className="atc-btn"
        disabled={!selectedVariant || !available}
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
        {available ? (
          <>
            <span>{dict.product.addToCart}</span>
            {priceText ? (
              <>
                <span aria-hidden="true">·</span>
                <bdi>{priceText}</bdi>
              </>
            ) : null}
          </>
        ) : (
          dict.product.soldOut
        )}
      </AddToCartButton>
    </div>
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
            className="atc-btn"
            disabled={!attributes || fetcher.state !== 'idle'}
          >
            {label}
          </button>
        </>
      )}
    </CartForm>
  );
}
