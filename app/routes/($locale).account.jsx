import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {useI18n} from '~/lib/useI18n';

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const {customer} = useLoaderData();
  const {dict} = useI18n();

  const heading = customer
    ? customer.firstName
      ? `${dict.account.welcome}, ${customer.firstName}`
      : `${dict.account.welcome}.`
    : dict.account.myAccount;

  return (
    <div className="account">
      <h1>{heading}</h1>
      <br />
      <AccountMenu />
      <br />
      <br />
      <Outlet context={{customer}} />
    </div>
  );
}

function AccountMenu() {
  const {dict, to} = useI18n();
  function isActiveStyle({isActive, isPending}) {
    return {
      fontWeight: isActive ? 'bold' : undefined,
      color: isPending ? 'grey' : 'inherit',
    };
  }

  return (
    <nav role="navigation">
      <NavLink to={to('/account/orders')} style={isActiveStyle}>
        {dict.account.orders} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <NavLink to={to('/account/profile')} style={isActiveStyle}>
        &nbsp; {dict.account.profile} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <NavLink to={to('/account/addresses')} style={isActiveStyle}>
        &nbsp; {dict.account.addresses} &nbsp;
      </NavLink>
      &nbsp;|&nbsp;
      <Logout />
    </nav>
  );
}

function Logout() {
  const {dict, to} = useI18n();
  return (
    <Form className="account-logout" method="POST" action={to('/account/logout')}>
      &nbsp;<button type="submit">{dict.account.signOut}</button>
    </Form>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
