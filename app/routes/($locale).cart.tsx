import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  data,
} from 'react-router';
import {Analytics, CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {useI18n} from '~/lib/useI18n';
import {getDictionary} from '~/lib/i18n';
import {isSameOriginPath} from '~/lib/.server/redirect.server';
import type {Route} from './+types/($locale).cart';

export const meta: Route.MetaFunction = ({matches}) => {
  const root = matches?.find?.((m) => m?.id === 'root');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- root match data shape is not exposed via generated types
  const dict = (root?.data as any)?.dict ?? getDictionary('he');
  return [{title: dict.cart.metaTitle}];
};

export const headers: Route.HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CartForm result is a discriminated union by action; per-branch narrowing is verbose and downstream code already accesses .cart/.errors/.warnings
  let result: any;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine discount codes already applied on cart
      discountCodes.push(...(inputs.discountCodes as string[]));

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes;
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo');
  if (typeof redirectTo === 'string' && isSameOriginPath(redirectTo, request)) {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

export async function loader({context}: Route.LoaderArgs) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  const cart = useLoaderData<typeof loader>();
  const {dict} = useI18n();

  return (
    <div className="cart">
      <h1>{dict.cart.pageTitle}</h1>
      <CartMain layout="page" cart={cart} />
      <Analytics.CartView />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const {dict} = useI18n();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : 'Something went wrong loading your cart.';
  return (
    <div className="cart">
      <h1>{dict.cart.pageTitle}</h1>
      <p role="alert">
        {status}: {message}
      </p>
    </div>
  );
}
