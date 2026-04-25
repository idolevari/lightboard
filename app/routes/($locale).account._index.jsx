import {redirect} from 'react-router';
import {detectLocaleFromRequest, localizedPath} from '~/lib/i18n';

export async function loader({request}) {
  const locale = detectLocaleFromRequest(request);
  return redirect(localizedPath('/account/orders', locale));
}

/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
