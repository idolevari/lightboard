import {Link, useLoaderData} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {canonicalUrl, pageTitle} from '~/lib/meta';
import type {Shop} from '@shopify/hydrogen/storefront-api-types';
import type {Route} from './+types/($locale).policies.$handle';

type SelectedPolicies = keyof Pick<
  Shop,
  'privacyPolicy' | 'shippingPolicy' | 'termsOfService' | 'refundPolicy'
>;

export const meta: Route.MetaFunction = ({data, matches, params}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches helpers in ~/lib/meta accept a narrower MetaMatch type than Route.MetaArgs surfaces
  const m = matches as any;
  return [
    {title: pageTitle(m, data?.policy.title)},
    {
      tagName: 'link',
      rel: 'canonical',
      href: canonicalUrl(m, `/policies/${params.handle ?? ''}`),
    },
  ];
};

export async function loader({params, context}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Response('No handle was passed in', {status: 404});
  }

  const policyName = params.handle.replace(
    /-([a-z])/g,
    (_: string, m1: string) => m1.toUpperCase(),
  ) as SelectedPolicies;

  const data = await context.storefront.query(POLICY_CONTENT_QUERY, {
    cache: context.storefront.CacheLong(),
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyName];

  if (!policy) {
    throw new Response('Could not find the policy', {status: 404});
  }

  return {policy};
}

export default function Policy() {
  const {policy} = useLoaderData<typeof loader>();
  const {dict, to} = useI18n();

  return (
    <article className="policy">
      <div className="policy-back">
        <Link to={to('/policies')}>{dict.policies.back}</Link>
      </div>
      <div
        className="policy-body"
        dangerouslySetInnerHTML={{__html: sanitizeShopifyHtml(policy.body)}}
      />
    </article>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Shop
const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
    }
  }
`;
