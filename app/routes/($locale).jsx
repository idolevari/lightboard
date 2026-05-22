import {Outlet, redirect} from 'react-router';
import {DEFAULT_LOCALE, SUPPORTED_LOCALES} from '~/lib/i18n';
import {enforceLaunchGate} from '~/lib/coming-soon';

/**
 * Layout route for every path under the optional locale segment.
 *
 * - `/foo`        → locale param is undefined → treat as default (HE)
 * - `/en/foo`     → locale param is 'en' → valid
 * - `/he/foo`     → redirect to `/foo` (HE is default, no prefix)
 * - `/xx/foo`     → unknown locale → fall through to 404 via storefrontRedirect
 *
 * When the launch gate is active, every nested path other than `/` is
 * redirected here so the root layout can render <ComingSoon /> without any
 * child route loader running and leaking data.
 *
 * @param {Route.LoaderArgs} args
 */
export async function loader({params, request, context}) {
  enforceLaunchGate(request, context.env);

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
