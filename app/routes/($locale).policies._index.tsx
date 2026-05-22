import {useLoaderData, Link} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {getDictionary} from '~/lib/i18n';
import type {PolicyItemFragment} from 'storefrontapi.generated';
import type {Route} from './+types/($locale).policies._index';

export const meta: Route.MetaFunction = ({matches}) => {
  const root = matches?.find?.((m) => m?.id === 'root');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- root match data shape is not exposed via generated types
  const dict = (root?.data as any)?.dict ?? getDictionary('he');
  return [{title: dict.policies.indexMeta}];
};

export async function loader({context}: Route.LoaderArgs) {
  const data = await context.storefront.query(POLICIES_QUERY, {
    cache: context.storefront.CacheLong(),
  });

  const shopPolicies = data.shop;
  const policies = [
    shopPolicies?.privacyPolicy,
    shopPolicies?.shippingPolicy,
    shopPolicies?.termsOfService,
    shopPolicies?.refundPolicy,
    shopPolicies?.subscriptionPolicy,
  ].filter((policy): policy is PolicyItemFragment => policy != null);

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();
  const {dict, to} = useI18n();

  const titleMap: Record<string, string> = dict.policies.titles ?? {};
  return (
    <article className="policies">
      <h1>{dict.policies.indexTitle}</h1>
      <ul className="policies-list">
        {policies.map((policy) => (
          <li key={policy.id}>
            <Link to={to(`/policies/${policy.handle}`)}>
              {titleMap[policy.handle] ?? policy.title}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
`;
