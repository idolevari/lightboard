import {isLaunchGateActive} from '~/lib/.server/coming-soon.server';
import {loadLlmsData, renderLlmsTxt} from '~/lib/.server/llms.server';
import type {Route} from './+types/[llms.txt]';

/**
 * /llms.txt (https://llmstxt.org): a short, factual guide to the brand for
 * AI assistants, built from live Shopify data. Hidden while the launch gate
 * is on, like every other data route.
 */
export async function loader({request, context}: Route.LoaderArgs) {
  if (isLaunchGateActive(request, context.env)) {
    throw new Response('Not found', {status: 404});
  }
  const data = await loadLlmsData(context.storefront);
  return new Response(renderLlmsTxt(data), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
}
