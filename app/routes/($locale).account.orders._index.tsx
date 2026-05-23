import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import {useRef} from 'react';
import {
  Money,
  getPaginationVariables,
  getSeoMeta,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
} from '~/lib/orderFilters';
import type {OrderFilterParams} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import type {Route} from './+types/($locale).account.orders._index';

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo as Parameters<typeof getSeoMeta>[0], data?.seo as Parameters<typeof getSeoMeta>[0]) ?? [];

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const seo = simpleSeo({
    title: dict.account.orders,
    url: absoluteUrl('/account/orders', locale),
  });

  return {customer: data.customer, filters, seo};
}

export default function Orders() {
  const {customer, filters} = useLoaderData<typeof loader>();
  const {orders} = customer;

  return (
    <div className="orders">
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

function OrdersTable({
  orders,
  filters,
}: {
  orders: CustomerOrdersFragment['orders'];
  filters: OrderFilterParams;
}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="acccount-orders" aria-live="polite">
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders}>
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

function EmptyOrders({hasFilters = false}: {hasFilters?: boolean}) {
  const {dict, to} = useI18n();
  return (
    <div>
      {hasFilters ? (
        <>
          <p>{dict.account.noOrders}</p>
          <br />
          <p>
            <Link to={to('/account/orders')}>{dict.account.clearFilters}</Link>
          </p>
        </>
      ) : (
        <>
          <p>{dict.account.noOrders}</p>
          <br />
          <p>
            <Link to={to('/collections')}>{dict.account.startShopping}</Link>
          </p>
        </>
      )}
    </div>
  );
}

function OrderSearchForm({
  currentFilters,
}: {
  currentFilters: OrderFilterParams;
}) {
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef<HTMLFormElement>(null);
  const {dict} = useI18n();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="order-search-form"
      aria-label={dict.account.searchOrders}
    >
      <fieldset className="order-search-fieldset">
        <legend className="order-search-legend">{dict.account.ordersFilter}</legend>

        <div className="order-search-inputs">
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder={dict.account.orderNumberPlaceholder}
            aria-label={dict.account.orderNumber}
            defaultValue={currentFilters.name || ''}
            className="order-search-input"
          />
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder={dict.account.confirmationNumberPlaceholder}
            aria-label={dict.account.confirmationNumber}
            defaultValue={currentFilters.confirmationNumber || ''}
            className="order-search-input"
          />
        </div>

        <div className="order-search-buttons">
          <button type="submit" disabled={isSearching}>
            {isSearching ? dict.common.loading : dict.account.searchBtn}
          </button>
          {hasFilters && (
            <button
              type="button"
              disabled={isSearching}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
            >
              {dict.account.clearBtn}
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  const {dict, to, locale} = useI18n();
  const orderHref = to(`/account/orders/${btoa(order.id)}`);
  const dateString = new Date(order.processedAt).toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    {year: 'numeric', month: 'long', day: 'numeric'},
  );
  return (
    <>
      <fieldset>
        <Link to={orderHref}>
          <strong>#{order.number}</strong>
        </Link>
        <p>{dateString}</p>
        {order.confirmationNumber && (
          <p>{dict.account.confirmationNumber}: {order.confirmationNumber}</p>
        )}
        <p>{order.financialStatus}</p>
        {fulfillmentStatus && <p>{fulfillmentStatus}</p>}
        <Money data={order.totalPrice} />
        <Link to={orderHref}>{dict.common.next} →</Link>
      </fieldset>
      <br />
    </>
  );
}
