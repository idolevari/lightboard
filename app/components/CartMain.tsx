import {useOptimisticCart} from '@shopify/hydrogen';
import {Link} from 'react-router';
import {useAside} from '~/components/Aside';
import {CartLineItem} from '~/components/CartLineItem';
import type {CartLine} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {useI18n} from '~/lib/useI18n';
import type {CartApiQueryFragment} from 'storefrontapi.generated';

export type CartLayout = 'page' | 'aside';

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};

type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

/**
 * Returns a map of all line items and their children.
 */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line && Array.isArray(line.lineComponents)) {
      const nested = getLineItemChildrenMap(line.lineComponents as CartLine[]);
      for (const [parentId, childIds] of Object.entries(nested)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}

export function CartMain({layout, cart: originalCart}: CartMainProps) {
  const cart = useOptimisticCart(originalCart);
  const {dict} = useI18n();

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(
    (cart?.lines?.nodes ?? []) as CartLine[],
  );

  return (
    <section
      className={className}
      aria-label={layout === 'page' ? dict.cart.asidePage : dict.cart.asideDrawer}
    >
      <CartEmpty hidden={linesCount} />
      <div className="cart-details">
        <p id="cart-lines" className="sr-only">
          {dict.cart.lineItems}
        </p>
        <div>
          <ul aria-labelledby="cart-lines">
            {((cart?.lines?.nodes ?? []) as CartLine[]).map((line) => {
              if (
                'parentRelationship' in line &&
                line.parentRelationship?.parent
              ) {
                return null;
              }
              return (
                <CartLineItem
                  key={line.id}
                  line={line}
                  layout={layout}
                  childrenMap={childrenMap}
                />
              );
            })}
          </ul>
        </div>
        {cartHasItems && <CartSummary cart={cart} layout={layout} />}
      </div>
    </section>
  );
}

function CartEmpty({hidden = false}: {hidden?: boolean}) {
  const {close} = useAside();
  const {dict, to} = useI18n();
  return (
    <div hidden={hidden}>
      <br />
      <p>{dict.cart.empty}</p>
      <br />
      <Link to={to('/collections')} onClick={close} prefetch="viewport">
        {dict.cart.continueShopping}
      </Link>
    </div>
  );
}
