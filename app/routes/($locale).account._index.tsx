import {redirect} from 'react-router';
import {detectLocaleFromRequest, localizedPath} from '~/lib/i18n';
import type {Route} from './+types/($locale).account._index';

export async function loader({request}: Route.LoaderArgs) {
  const locale = detectLocaleFromRequest(request);
  return redirect(localizedPath('/account/orders', locale));
}
