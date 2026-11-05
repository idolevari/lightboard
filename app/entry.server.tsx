import {ServerRouter} from 'react-router';
import type {EntryContext} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';
import type {HydrogenRouterContextProvider} from '@shopify/hydrogen';

/**
 * Browser features the storefront never needs. The photo customizer uses a
 * plain <input type="file"> (no getUserMedia), so camera/microphone stay off.
 * `payment=(self)` keeps the Payment Request API available to first-party
 * code only; checkout itself runs on Shopify's domain.
 */
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'usb=()',
  'payment=(self)',
].join(', ');

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  context: HydrogenRouterContextProvider,
) {
  // Build-time constant (Vite replaces it). Do NOT read NODE_ENV from
  // `context.env`: Oxygen never injects it, which made production CSPs
  // allow http://localhost:* and ws://localhost:*.
  const isDev = process.env.NODE_ENV === 'development';
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      // Same fallback as root.tsx: PUBLIC_CHECKOUT_DOMAIN isn't always
      // injected into the worker runtime.
      checkoutDomain:
        context.env.PUBLIC_CHECKOUT_DOMAIN || context.env.PUBLIC_STORE_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    objectSrc: ["'none'"],
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
    frameSrc: [
      "'self'",
      'https://www.facebook.com',
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

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Content-Security-Policy', header);
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  responseHeaders.set('Permissions-Policy', PERMISSIONS_POLICY);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
