import {redirect} from 'react-router';
import {detectLocaleFromRequest, localizedPath} from '~/lib/i18n';
import type {Route} from './+types/($locale).account.$';

// fallback wild card for all unauthenticated routes in account section
export async function loader({context, request}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();
  const locale = detectLocaleFromRequest(request);
  return redirect(localizedPath('/account', locale));
}
