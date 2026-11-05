import {createHydrogenContext} from '@shopify/hydrogen';
import {AppSession} from '~/lib/.server/session.server';
import {primePreviewCookie} from '~/lib/.server/coming-soon.server';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {detectLocaleFromRequest, getLocaleConfig} from '~/lib/i18n';

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 */
export async function createHydrogenRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
    // Launch-gate bypass cookie is an HMAC; compute the expected value
    // before any (synchronous) gate check runs. No-op when the gate is off.
    primePreviewCookie(env),
  ]);

  const hydrogenContext = createHydrogenContext({
    env,
    request,
    cache,
    waitUntil,
    session,
    i18n: (() => {
      const locale = detectLocaleFromRequest(request);
      const config = getLocaleConfig(locale);
      return {language: config.lang, country: config.country};
    })(),
    cart: {
      queryFragment: CART_QUERY_FRAGMENT,
    },
  });

  return hydrogenContext;
}
