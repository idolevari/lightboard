import {data} from 'react-router';
import {buildPreviewCookie, tokensMatch} from '~/lib/coming-soon';

/**
 * Launch-gate bypass route.
 *
 *   GET /preview?token=<env.PREVIEW_TOKEN>
 *
 * Sets `lb_preview=1` (HttpOnly, Secure, SameSite=Lax, 30 days) and redirects
 * to `/` so the next request renders the real storefront. Any unknown or
 * missing token returns 404 — the gate stays in place and the URL surface is
 * indistinguishable from a typo.
 */
export async function loader({request, context}) {
  const expected = context.env?.PREVIEW_TOKEN;
  if (!expected) {
    return data({error: 'not-found'}, {status: 404});
  }
  const url = new URL(request.url);
  const provided = url.searchParams.get('token');
  if (!provided || !tokensMatch(provided, expected)) {
    return data({error: 'not-found'}, {status: 404});
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': buildPreviewCookie(),
    },
  });
}

export default function Preview() {
  return null;
}
