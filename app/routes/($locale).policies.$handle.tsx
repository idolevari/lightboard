import {Link, useLoaderData} from 'react-router';
import {getSeoMeta} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import type {Shop} from '@shopify/hydrogen/storefront-api-types';
import type {Route} from './+types/($locale).policies.$handle';

type SelectedPolicies = keyof Pick<
  Shop,
  'privacyPolicy' | 'shippingPolicy' | 'termsOfService' | 'refundPolicy'
>;

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo as Parameters<typeof getSeoMeta>[0], data?.seo as Parameters<typeof getSeoMeta>[0]) ?? [];

export async function loader({params, context, request}: Route.LoaderArgs) {
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

  const locale = detectLocaleFromRequest(request);
  const seo = simpleSeo({
    title: policy.title,
    url: absoluteUrl(`/policies/${params.handle}`, locale),
  });

  return {policy, seo};
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
