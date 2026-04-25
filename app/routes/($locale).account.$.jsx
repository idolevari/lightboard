import {redirect} from 'react-router';
import {detectLocaleFromRequest, localizedPath} from '~/lib/i18n';

// fallback wild card for all unauthenticated routes in account section
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context, request}) {
  await context.customerAccount.handleAuthStatus();
  const locale = detectLocaleFromRequest(request);
  return redirect(localizedPath('/account', locale));
}

/** @typedef {import('./+types/account.$').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
