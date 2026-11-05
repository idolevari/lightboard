import {useLoaderData, data} from 'react-router';
import {Analytics, CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {RouteError} from '~/components/RouteError';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {isSameOriginPath} from '~/lib/.server/redirect.server';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {NO_INDEX, routeMeta} from '~/lib/seo-urls';
import type {Route} from './+types/($locale).cart';

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data, overrides: NO_INDEX});

export const headers: Route.HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  let formData: FormData;
  let cartInput: ReturnType<typeof CartForm.getFormInput>;
  try {
    formData = await request.formData();
    cartInput = CartForm.getFormInput(formData);
  } catch {
    // Malformed body / cartFormInput JSON: client error, not a 500.
    return data({error: 'invalid-form-data'}, {status: 400});
  }
  const {action, inputs} = cartInput;

  if (!action) {
    return data({error: 'invalid-action'}, {status: 400});
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
      // Unknown action from a crafted form: client error, not a 500.
      return data({error: 'invalid-action'}, {status: 400});
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

export async function loader({context, request}: Route.LoaderArgs) {
  const {cart} = context;
  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const cartData = await cart.get();
  const {seo} = simpleSeo({
    title: dict.cart.metaTitle,
    url: absoluteUrl('/cart', locale),
  });
  return {
    cart: cartData,
    seo,
  };
}

export default function Cart() {
  const {cart} = useLoaderData<typeof loader>();
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
  return <RouteError />;
}
