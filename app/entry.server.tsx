import {ServerRouter} from 'react-router';
import type {EntryContext} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';
import type {HydrogenRouterContextProvider} from '@shopify/hydrogen';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  const isDev = context.env.NODE_ENV !== 'production';
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    // Photo customizer creates blob: URLs for in-browser cropping/preview, and
    // pulls Google Fonts stylesheets configured in root.jsx. Both need explicit
    // CSP allowances since Hydrogen's defaults don't include them.
    // Note: 'data:' is intentionally NOT in imgSrc — data URIs can be abused
    // as an XSS vector via injected HTML.
    imgSrc: [
      "'self'",
      'blob:',
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://www.facebook.com',
      ...(isDev ? ['http://localhost:*'] : []),
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'https://fonts.googleapis.com',
      ...(isDev ? ['http://localhost:*'] : []),
    ],
    fontSrc: [
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
      'https://cdn.shopify.com',
    ],
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://connect.facebook.net',
      ...(isDev ? ['http://localhost:*'] : []),
    ],
    connectSrc: [
      "'self'",
      'https://www.facebook.com',
      ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
