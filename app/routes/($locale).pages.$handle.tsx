import {useLoaderData} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {mailtoHref, telHref, useBusiness, whatsappHref} from '~/lib/brand';
import {redirectIfHandleIsLocalized} from '~/lib/.server/redirect.server';
import {checkForTrailingEncodedSpaces} from '~/lib/.server/url.server';
import {sanitizeShopifyHtml} from '~/lib/sanitize';
import {detectLocaleFromRequest} from '~/lib/i18n';
import {absoluteUrl, simpleSeo} from '~/lib/.server/seo.server';
import {routeMeta} from '~/lib/seo-urls';
import {RouteError} from '~/components/RouteError';
import type {Route} from './+types/($locale).pages.$handle';

export const meta: Route.MetaFunction = ({data, matches}) =>
  routeMeta({matches, data});

export async function loader(args: Route.LoaderArgs) {
  const redirectResponse = checkForTrailingEncodedSpaces(args.request);
  if (redirectResponse) throw redirectResponse;

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData();

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request, params}: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const [{page}] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      cache: context.storefront.CacheLong(),
      variables: {
        handle: params.handle,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  const locale = detectLocaleFromRequest(request);
  const {seo} = simpleSeo({
    title: page.seo?.title || page.title,
    description: page.seo?.description || undefined,
    url: absoluteUrl(`/pages/${page.handle}`, locale),
  });

  return {
    page,
    seo,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData() {
  return {};
}

const CONTACT_HANDLE = 'contact';

function stripTags(html: string | null | undefined) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export default function Page() {
  const {page} = useLoaderData<typeof loader>();
  const {dict} = useI18n();
  const isContact = page.handle === CONTACT_HANDLE;
  const hasBody = stripTags(page.body).length > 0;
  // Shopify page bodies (e.g. the accessibility statement) often carry
  // their own <h1>. Only add one when the body doesn't, so every page has
  // exactly one.
  const bodyHasH1 = /<h1[\s>]/i.test(page.body ?? '');
  const title = isContact ? dict.contact.title : page.title;

  return (
    <article className="page">
      {!bodyHasH1 ? <h1>{title}</h1> : null}
      {isContact ? <ContactBlock /> : null}
      {hasBody ? (
        <div
          className="page-body"
          dangerouslySetInnerHTML={{__html: sanitizeShopifyHtml(page.body)}}
        />
      ) : null}
    </article>
  );
}

/**
 * Built-in contact channels, rendered from the shop `business.*`
 * metafields already loaded by the root loader — so /pages/contact is never
 * a blank dead end even when the Shopify page body is empty.
 */
function ContactBlock() {
  const {dict} = useI18n();
  const c = dict.contact;
  const b = useBusiness();
  const wa = whatsappHref(b, dict.whatsapp?.prefill);
  const tel = telHref(b);
  const mail = mailtoHref(b);
  return (
    <section aria-label={c.title}>
      <p className="contact-kicker">{c.kicker}</p>
      <ul className="contact-actions">
        {wa ? (
          <li>
            <a
              className="contact-btn contact-btn--primary"
              href={wa}
              target="_blank"
              rel="noreferrer"
            >
              <img src="/whatsapp.svg" alt="" width="26" height="26" />
              <span>{dict.whatsapp?.label ?? c.whatsapp}</span>
            </a>
          </li>
        ) : null}
        {tel && b.phoneDisplay ? (
          <li>
            <a className="contact-btn" href={tel}>
              <span className="contact-btn__label">{c.phone}</span>
              <bdi dir="ltr">{b.phoneDisplay}</bdi>
            </a>
          </li>
        ) : null}
        {mail ? (
          <li>
            <a className="contact-btn" href={mail}>
              <span className="contact-btn__label">{c.email}</span>
              <bdi dir="ltr">{b.email}</bdi>
            </a>
          </li>
        ) : null}
        {b.instagram ? (
          <li>
            <a
              className="contact-btn"
              href={b.instagram}
              target="_blank"
              rel="noreferrer"
            >
              <span className="contact-btn__label">{c.instagram}</span>
              <bdi dir="ltr">
                {b.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
              </bdi>
            </a>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
`;

export function ErrorBoundary() {
  return <RouteError />;
}
