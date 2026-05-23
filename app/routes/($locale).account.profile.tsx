import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {getSeoMeta} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {RouteError} from '~/components/RouteError';
import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import type {Route} from './+types/($locale).account.profile';

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo as Parameters<typeof getSeoMeta>[0], data?.seo as Parameters<typeof getSeoMeta>[0]) ?? [];

export async function loader({context, request}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  return {
    seo: simpleSeo({
      title: dict.account.profile,
      url: absoluteUrl('/account/profile', locale),
    }),
  };
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customer: CustomerUpdateInput = {};
    const validInputKeys = ['firstName', 'lastName'] as const;
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key as (typeof validInputKeys)[number])) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        (customer as Record<string, string>)[key] = value;
      }
    }

    // update customer and possibly password
    const {data: mutationData, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!mutationData?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: mutationData?.customerUpdate?.customer,
    };
  } catch (error) {
    return data(
      {error: error instanceof Error ? error.message : String(error), customer: null},
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const actionData = useActionData<typeof action>();
  const customer =
    (actionData && 'customer' in actionData ? actionData.customer : null) ??
    account?.customer;
  const actionError =
    actionData && 'error' in actionData ? actionData.error : null;
  const {dict} = useI18n();

  return (
    <div className="account-profile">
      <h2>{dict.account.myProfile}</h2>
      <br />
      <Form method="PUT">
        <legend>{dict.account.personalInfo}</legend>
        <fieldset>
          <label htmlFor="firstName">{dict.account.firstName}</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder={dict.account.firstName}
            aria-label={dict.account.firstName}
            defaultValue={customer.firstName ?? ''}
            minLength={2}
          />
          <label htmlFor="lastName">{dict.account.lastName}</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder={dict.account.lastName}
            aria-label={dict.account.lastName}
            defaultValue={customer.lastName ?? ''}
            minLength={2}
          />
        </fieldset>
        {actionError ? (
          <p>
            <mark>
              <small>{actionError}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        <button type="submit" disabled={state !== 'idle'}>
          {state !== 'idle' ? dict.common.loading : dict.common.save}
        </button>
      </Form>
    </div>
  );
}

export function ErrorBoundary() {
  return <RouteError />;
}
