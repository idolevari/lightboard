import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import type {Fetcher} from 'react-router';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {RouteError} from '~/components/RouteError';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
import type {CustomerAddressInput} from '@shopify/hydrogen/customer-account-api-types';
import type {Route} from './+types/($locale).account.addresses';

type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null | boolean;
  deletedAddress?: string | null;
  error: Record<string, string> | string | null;
  updatedAddress?: CustomerAddressInput;
};

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

export async function loader({context, request}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const {seo} = simpleSeo({
    title: dict.account.addresses,
    url: absoluteUrl('/account/addresses', locale),
  });
  return {seo};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return data(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address: Record<string, string> = {};
    const keys = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ] as const;

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data: mutationData, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (mutationData?.customerAddressCreate?.userErrors?.length) {
            throw new Error(
              mutationData?.customerAddressCreate?.userErrors[0].message,
            );
          }

          if (!mutationData?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return {
            error: null,
            createdAddress: mutationData?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: String(error)}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data: mutationData, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (mutationData?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(
              mutationData?.customerAddressUpdate?.userErrors[0].message,
            );
          }

          if (!mutationData?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: String(error)}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data: mutationData, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (mutationData?.customerAddressDelete?.userErrors?.length) {
            throw new Error(
              mutationData?.customerAddressDelete?.userErrors[0].message,
            );
          }

          if (!mutationData?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return {error: null, deletedAddress: addressId};
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: String(error)}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return data(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return data(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return data(
      {error: String(error)},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;
  const {dict} = useI18n();

  return (
    <div className="account-addresses">
      <h2>{dict.account.addressesTitle}</h2>
      <br />
      <div>
        <div>
          <legend>{dict.account.createAddress}</legend>
          <NewAddressForm key={addresses.nodes.length} />
        </div>
        <br />
        <hr />
        <br />
        {!addresses.nodes.length ? (
          <p>{dict.common.no}.</p>
        ) : (
          <ExistingAddresses
            addresses={addresses}
            defaultAddress={defaultAddress}
          />
        )}
      </div>
    </div>
  );
}

function NewAddressForm() {
  const {dict} = useI18n();
  const newAddress: AddressFragment = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: null,
    firstName: '',
    formatted: [],
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  };

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div>
          <button
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            {stateForMethod('POST') !== 'idle' ? dict.common.loading : dict.common.save}
          </button>
        </div>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  const {dict} = useI18n();
  return (
    <div>
      <legend>{dict.account.existingAddresses}</legend>
      {addresses.nodes.map((address) => (
        <AddressForm
          key={address.id}
          addressId={address.id}
          address={address}
          defaultAddress={defaultAddress}
        >
          {({stateForMethod}) => (
            <div>
              <button
                disabled={stateForMethod('PUT') !== 'idle'}
                formMethod="PUT"
                type="submit"
              >
                {stateForMethod('PUT') !== 'idle' ? dict.common.loading : dict.common.save}
              </button>
              <button
                disabled={stateForMethod('DELETE') !== 'idle'}
                formMethod="DELETE"
                type="submit"
              >
                {stateForMethod('DELETE') !== 'idle' ? dict.common.loading : dict.common.delete}
              </button>
            </div>
          )}
        </AddressForm>
      ))}
    </div>
  );
}

export function AddressForm({
  addressId,
  address,
  defaultAddress,
  children,
}: {
  addressId: AddressFragment['id'];
  address: CustomerAddressInput | AddressFragment;
  defaultAddress: CustomerFragment['defaultAddress'];
  children: (props: {
    stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
  }) => React.ReactNode;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<typeof action>() as ActionResponse | undefined;
  const error =
    action?.error && typeof action.error === 'object'
      ? action.error[addressId]
      : undefined;
  const isDefaultAddress = defaultAddress?.id === addressId;
  const {dict} = useI18n();
  const a = dict.account;
  return (
    <Form id={addressId}>
      <fieldset>
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <label htmlFor="firstName">{a.firstName}*</label>
        <input
          aria-label={a.firstName}
          autoComplete="given-name"
          defaultValue={address?.firstName ?? ''}
          id="firstName"
          name="firstName"
          placeholder={a.firstName}
          required
          type="text"
        />
        <label htmlFor="lastName">{a.lastName}*</label>
        <input
          aria-label={a.lastName}
          autoComplete="family-name"
          defaultValue={address?.lastName ?? ''}
          id="lastName"
          name="lastName"
          placeholder={a.lastName}
          required
          type="text"
        />
        <label htmlFor="company">{a.company}</label>
        <input
          aria-label={a.company}
          autoComplete="organization"
          defaultValue={address?.company ?? ''}
          id="company"
          name="company"
          placeholder={a.company}
          type="text"
        />
        <label htmlFor="address1">{a.addressLine1}*</label>
        <input
          aria-label={a.addressLine1}
          autoComplete="address-line1"
          defaultValue={address?.address1 ?? ''}
          id="address1"
          name="address1"
          placeholder={a.addressLine1Required}
          required
          type="text"
        />
        <label htmlFor="address2">{a.addressLine2}</label>
        <input
          aria-label={a.addressLine2}
          autoComplete="address-line2"
          defaultValue={address?.address2 ?? ''}
          id="address2"
          name="address2"
          placeholder={a.addressLine2}
          type="text"
        />
        <label htmlFor="city">{a.city}*</label>
        <input
          aria-label={a.city}
          autoComplete="address-level2"
          defaultValue={address?.city ?? ''}
          id="city"
          name="city"
          placeholder={a.city}
          required
          type="text"
        />
        <label htmlFor="zoneCode">{a.stateProvince}*</label>
        <input
          aria-label={a.stateProvince}
          autoComplete="address-level1"
          defaultValue={address?.zoneCode ?? ''}
          id="zoneCode"
          name="zoneCode"
          placeholder={a.stateProvince}
          required
          type="text"
        />
        <label htmlFor="zip">{a.zipPlaceholder}*</label>
        <input
          aria-label={a.zip}
          autoComplete="postal-code"
          defaultValue={address?.zip ?? ''}
          id="zip"
          name="zip"
          placeholder={a.zipPlaceholder}
          required
          type="text"
        />
        <label htmlFor="territoryCode">{a.countryCode}*</label>
        <input
          aria-label={a.countryCode}
          autoComplete="country"
          defaultValue={address?.territoryCode ?? ''}
          id="territoryCode"
          name="territoryCode"
          placeholder={a.country}
          required
          type="text"
          maxLength={2}
        />
        <label htmlFor="phoneNumber">{a.phone}</label>
        <input
          aria-label={a.phoneNumber}
          autoComplete="tel"
          defaultValue={address?.phoneNumber ?? ''}
          id="phoneNumber"
          name="phoneNumber"
          placeholder="+972000000000"
          pattern="^\+?[1-9]\d{3,14}$"
          type="tel"
        />
        <div>
          <input
            defaultChecked={isDefaultAddress}
            id="defaultAddress"
            name="defaultAddress"
            type="checkbox"
          />
          <label htmlFor="defaultAddress">{a.setAsDefault}</label>
        </div>
        {error ? (
          <p>
            <mark>
              <small>{error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        {children({
          stateForMethod: (method) => (formMethod === method ? state : 'idle'),
        })}
      </fieldset>
    </Form>
  );
}

export function ErrorBoundary() {
  return <RouteError />;
}
