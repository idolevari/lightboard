import {useLoaderData, Link} from 'react-router';
import {getSeoMeta} from '@shopify/hydrogen';
import {useI18n} from '~/lib/useI18n';
import {detectLocaleFromRequest, getDictionary} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {RouteError} from '~/components/RouteError';
import type {PolicyItemFragment} from 'storefrontapi.generated';
import type {Route} from './+types/($locale).policies._index';

export const meta: Route.MetaFunction = ({data, matches}) =>
  getSeoMeta(matches[0]?.data?.seo as Parameters<typeof getSeoMeta>[0], data?.seo as Parameters<typeof getSeoMeta>[0]) ?? [];

export async function loader({context, request}: Route.LoaderArgs) {
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

  const locale = detectLocaleFromRequest(request);
  const dict = getDictionary(locale);
  const seo = simpleSeo({
    title: dict.policies.indexMeta,
    url: absoluteUrl('/policies', locale),
  });

  return {policies, seo};
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

export function ErrorBoundary() {
  return <RouteError />;
}
