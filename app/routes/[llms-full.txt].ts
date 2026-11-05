import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {loadLlmsData, renderLlmsFullTxt} from '~/lib/.server/llms.server';
import type {Route} from './+types/[llms-full.txt]';

/**
 * /llms-full.txt: /llms.txt plus product descriptions, specs, FAQs (HE+EN)
 * and the shipping and refund policy text, all from live Shopify data.
 */
export async function loader({request, context}: Route.LoaderArgs) {
  if (isLaunchGateActive(request, context.env)) {
    throw new Response('Not found', {status: 404});
  }
  const data = await loadLlmsData(context.storefront);
  return new Response(renderLlmsFullTxt(data), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
