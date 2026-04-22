import {redirect} from 'react-router';

const PREVIEW_TOKEN = 'surfsup2026';

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader({request}) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (token !== PREVIEW_TOKEN) {
    return new Response('Not found', {status: 404});
  }

  return redirect('/', {
    headers: {
      'Set-Cookie': `lb_preview=true; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax`,
    },
  });
}
