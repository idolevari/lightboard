import type {ReactNode} from 'react';
import {CartForm, Image} from '@shopify/hydrogen';
import type {OptimisticCartLine, CartReturn} from '@shopify/hydrogen';
import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import {useVariantUrl} from '~/lib/variants';
import {Link} from 'react-router';
import {ProductPrice} from './ProductPrice';
import {AutoLang} from './AutoLang';
import {useAside} from './Aside';
import {useI18n} from '~/lib/useI18n';
import {
  translateOptionName,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout, LineItemChildrenMap} from '~/components/CartMain';
import {BoardThumb} from '~/components/PhotoCustomizer/PrintboardPreview';
import {LINE_ATTR} from '~/lib/customizer-config';
import {withParams} from '~/lib/photos';
import {findPreset, presetLabel} from '~/lib/printboard-presets';

export type CartLine = OptimisticCartLine<CartApiQueryFragment | CartReturn>;

const MAX_PHOTO_ATTRS = 3;
const TRUSTED_PHOTO_HOST = 'https://cdn.shopify.com/';

type LineAttribute = {key: string; value?: string | null};

/**
 * Pull the photo URLs (`Photo 1`…: three for a Lightboard, one print for a
 * Printboard) out of a cart line's attributes, if present.
 * Returns null when the line is not a photo-customized line.
 *
 * Cart line attributes are buyer-supplied and can be set by any client-side
 * Storefront API mutation. We only render URLs that live on the Shopify CDN
 * to prevent a crafted cart from turning a line item into a tracking pixel
 * or pulling external content into the page.
 */
function getLinePhotoUrls(
  attributes: ReadonlyArray<LineAttribute> | null | undefined,
): string[] | null {
  if (!Array.isArray(attributes) || attributes.length === 0) return null;
  const map = new Map(attributes.map((a) => [a.key, a.value ?? '']));
  const urls: string[] = [];
  for (let n = 1; n <= MAX_PHOTO_ATTRS; n += 1) {
    const url = map.get(LINE_ATTR.photo(n));
    if (!url) break;
    urls.push(url);
  }
  if (urls.length === 0) return null;
  if (
    !urls.every(
      (u) => typeof u === 'string' && u.startsWith(TRUSTED_PHOTO_HOST),
    )
  ) {
    return null;
  }
  return urls;
}

function attrValue(
  attributes: ReadonlyArray<LineAttribute> | null | undefined,
  key: string,
): string | null {
  return attributes?.find((a) => a.key === key)?.value || null;
}

type CartLineItemProps = {
  layout: CartLayout;
  line: CartLine;
  childrenMap: LineItemChildrenMap;
};

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * If the line is a parent line that has child components (like warranties or gift wrapping), they are
 * rendered nested below the parent line.
 */
export function CartLineItem({layout, line, childrenMap}: CartLineItemProps) {
  const {id, merchandise, attributes} = line;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const {dict, to, locale} = useI18n();
  const lineItemChildren = childrenMap[id];
  const childrenLabelId = `cart-line-children-${id}`;
  const photoUrls = getLinePhotoUrls(attributes);
  // One print photo = a Printboard line: board-shaped thumb + design name.
  const printUrl = photoUrls?.length === 1 ? photoUrls[0] : null;
  const designId = attrValue(attributes, LINE_ATTR.designId);
  const designName = printUrl
    ? designId
      ? presetLabel(findPreset(designId), locale) ||
        attrValue(attributes, LINE_ATTR.design) ||
        designId
      : dict.printboard?.ownPhoto
    : null;
  const editPhotosHref = photoUrls
    ? `${to(`/products/${product.handle}`)}?editLineId=${encodeURIComponent(id)}`
    : null;

  return (
    <li key={id} className="cart-line">
      <div className="cart-line-inner">
        {printUrl ? (
          <div className="cart-line-image cart-line-image--board">
            <BoardThumb
              src={withParams(printUrl, 'width=200')}
              label={[dict.printboard?.title, designName]
                .filter(Boolean)
                .join(' – ')}
            />
          </div>
        ) : (
          image && (
            <Image
              className="cart-line-image"
              alt={title}
              aspectRatio="1/1"
              data={image}
              height={100}
              loading="lazy"
              width={100}
            />
          )
        )}

        <div>
          <Link
            prefetch="intent"
            to={lineItemUrl}
            onClick={() => {
              if (layout === 'aside') {
                close();
              }
            }}
          >
            <p className="cart-line-title">
              <strong>
                {printUrl && dict.printboard?.title ? (
                  dict.printboard.title
                ) : (
                  <AutoLang text={product.title} />
                )}
              </strong>
            </p>
          </Link>
          <ProductPrice price={line?.cost?.totalAmount} />
          <ul>
            {selectedOptions
              .filter(
                (option) =>
                  !(
                    option.name === 'Title' && option.value === 'Default Title'
                  ),
              )
              .map((option) => (
                <li key={option.name}>
                  <small>
                    {translateOptionName(dict, option.name)}:{' '}
                    {translateOptionValue(dict, option.value)}
                  </small>
                </li>
              ))}
          </ul>
          {printUrl ? (
            <div className="cart-line-photos">
              <p className="cart-line-design">
                {dict.printboard?.cartDesign}: {designName}
              </p>
              {editPhotosHref ? (
                <Link
                  to={editPhotosHref}
                  prefetch="intent"
                  className="cart-line-photos__edit"
                  onClick={() => {
                    if (layout === 'aside') close();
                  }}
                >
                  {dict.printboard?.editFromCart}
                </Link>
              ) : null}
            </div>
          ) : photoUrls ? (
            <div className="cart-line-photos">
              <div className="cart-line-photos__thumbs is-polaroids">
                {photoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={
                      dict.photoCustomizer?.slotLabel?.replace(
                        '{n}',
                        String(i + 1),
                      ) ?? `Photo ${i + 1}`
                    }
                    className="cart-line-photos__thumb"
                    loading="lazy"
                  />
                ))}
              </div>
              {editPhotosHref ? (
                <Link
                  to={editPhotosHref}
                  prefetch="intent"
                  className="cart-line-photos__edit"
                  onClick={() => {
                    if (layout === 'aside') close();
                  }}
                >
                  {dict.photoCustomizer?.editFromCart ?? 'Edit photos'}
                </Link>
              ) : null}
            </div>
          ) : null}
          <CartLineQuantity line={line} />
        </div>
      </div>

      {lineItemChildren ? (
        <div>
          <p id={childrenLabelId} className="sr-only">
            {dict.cart.lineItemsWith} {product.title}
          </p>
          <ul aria-labelledby={childrenLabelId} className="cart-line-children">
            {lineItemChildren.map((childLine) => (
              <CartLineItem
                childrenMap={childrenMap}
                key={childLine.id}
                line={childLine}
                layout={layout}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 */
function CartLineQuantity({line}: {line: CartLine}) {
  const {dict} = useI18n();
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="cart-line-quantity">
      <small className="cart-line-qty-label">
        {dict.cart.quantity}: {quantity}
      </small>
      <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
        <button
          type="submit"
          className="cart-qty-btn"
          aria-label={dict.cart.decreaseQuantity}
          disabled={quantity <= 1 || !!isOptimistic}
          name="decrease-quantity"
          value={prevQuantity}
        >
          <span aria-hidden="true">&#8722;</span>
        </button>
      </CartLineUpdateButton>
      <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
        <button
          type="submit"
          className="cart-qty-btn"
          aria-label={dict.cart.increaseQuantity}
          name="increase-quantity"
          value={nextQuantity}
          disabled={!!isOptimistic}
        >
          <span aria-hidden="true">&#43;</span>
        </button>
      </CartLineUpdateButton>
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 */
function CartLineRemoveButton({
  lineIds,
  disabled,
}: {
  lineIds: string[];
  disabled: boolean;
}) {
  const {dict} = useI18n();
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      {/* Destructive but secondary: a quiet text button, never a dark pill. */}
      <button disabled={disabled} type="submit" className="cart-line-remove">
        {dict.cart.removeBtn}
      </button>
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: ReactNode;
  lines: CartLineUpdateInput[];
}) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 */
function getUpdateKey(lineIds: string[]): string {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}
