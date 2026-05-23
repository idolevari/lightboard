import {redirect, useLoaderData} from 'react-router';
import {Money, Image} from '@shopify/hydrogen';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {RouteError} from '~/components/RouteError';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import type {Route} from './+types/($locale).account.orders.$id';

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

export async function loader({params, context, request}: Route.LoaderArgs) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const {data, errors} = await customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {
      orderId,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' ? firstDiscount : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? firstDiscount.percentage
      : null;

  const locale = detectLocaleFromRequest(request);
  const {seo} = simpleSeo({
    title: `Order ${order.name}`,
    url: absoluteUrl(`/account/orders/${params.id}`, locale),
  });

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    seo,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData<typeof loader>();
  const {dict, locale} = useI18n();
  const t = dict.account.orderTable;
  const dateString = new Date(order.processedAt).toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    {year: 'numeric', month: 'long', day: 'numeric'},
  );
  return (
    <div className="account-order">
      <h2>{dict.account.orders} {order.name}</h2>
      <p>{dateString}</p>
      {order.confirmationNumber && (
        <p>{dict.account.confirmationNumber}: {order.confirmationNumber}</p>
      )}
      <br />
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">{t.product}</th>
              <th scope="col">{t.price}</th>
              <th scope="col">{t.quantity}</th>
              <th scope="col">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem, lineItemIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
            ))}
          </tbody>
          <tfoot>
            {((discountValue && discountValue.amount) ||
              discountPercentage) && (
              <tr>
                <th scope="row" colSpan={3}>
                  <p>{t.discounts}</p>
                </th>
                <th scope="row">
                  <p>{t.discounts}</p>
                </th>
                <td>
                  {discountPercentage ? (
                    <span>-{discountPercentage}%</span>
                  ) : (
                    discountValue && <Money data={discountValue} />
                  )}
                </td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={3}>
                <p>{t.subtotal}</p>
              </th>
              <th scope="row">
                <p>{t.subtotal}</p>
              </th>
              <td>
                {order.subtotal ? <Money data={order.subtotal} /> : null}
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                {t.tax}
              </th>
              <th scope="row">
                <p>{t.tax}</p>
              </th>
              <td>
                {order.totalTax ? <Money data={order.totalTax} /> : null}
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                {t.totalRow}
              </th>
              <th scope="row">
                <p>{t.totalRow}</p>
              </th>
              <td>
                <Money data={order.totalPrice} />
              </td>
            </tr>
          </tfoot>
        </table>
        <div>
          <h3>{dict.account.shippingAddress}</h3>
          {order?.shippingAddress ? (
            <address>
              <p>{order.shippingAddress.name}</p>
              {order.shippingAddress.formatted ? (
                <p>{order.shippingAddress.formatted}</p>
              ) : (
                ''
              )}
              {order.shippingAddress.formattedArea ? (
                <p>{order.shippingAddress.formattedArea}</p>
              ) : (
                ''
              )}
            </address>
          ) : (
            <p>{dict.account.noShippingAddress}</p>
          )}
          <h3>{dict.account.status}</h3>
          <div>
            <p>{fulfillmentStatus}</p>
          </div>
        </div>
      </div>
      <br />
      <p>
        <a target="_blank" href={order.statusPageUrl} rel="noreferrer">
          {dict.account.status} →
        </a>
      </p>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  return (
    <tr key={lineItem.id}>
      <td>
        <div>
          {lineItem?.image && (
            <div>
              <Image data={lineItem.image} width={96} height={96} />
            </div>
          )}
          <div>
            <p>{lineItem.title}</p>
            <small>{lineItem.variantTitle}</small>
          </div>
        </div>
      </td>
      <td>
        {lineItem.price ? <Money data={lineItem.price} /> : null}
      </td>
      <td>{lineItem.quantity}</td>
      <td>
        {lineItem.totalDiscount ? (
          <Money data={lineItem.totalDiscount} />
        ) : null}
      </td>
    </tr>
  );
}

export function ErrorBoundary() {
  return <RouteError />;
}
