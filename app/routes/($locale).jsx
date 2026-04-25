import {Outlet, redirect} from 'react-router';
import {DEFAULT_LOCALE, SUPPORTED_LOCALES} from '~/lib/i18n';

/**
 * Layout route for every path under the optional locale segment.
 *
 * - `/foo`        → locale param is undefined → treat as default (HE)
 * - `/en/foo`     → locale param is 'en' → valid
 * - `/he/foo`     → redirect to `/foo` (HE is default, no prefix)
 * - `/xx/foo`     → unknown locale → fall through to 404 via storefrontRedirect
 *
 * @param {Route.LoaderArgs} args
 */
export async function loader({params, request}) {
  const raw = params.locale;
  if (raw === undefined) return null;

  if (!SUPPORTED_LOCALES.includes(raw)) {
    // Let the request fall through to Hydrogen's 404 handling (which checks
    // Shopify URL redirects before truly 404-ing).
    throw new Response('Not found', {status: 404});
  }

  if (raw === DEFAULT_LOCALE) {
    const url = new URL(request.url);
    const rest = url.pathname.replace(new RegExp(`^/${raw}`), '') || '/';
    return redirect(rest + url.search);
  }

  return null;
}

export default function LocaleLayout() {
  return <Outlet />;
}

/** @typedef {import('./+types/($locale)').Route} Route */
