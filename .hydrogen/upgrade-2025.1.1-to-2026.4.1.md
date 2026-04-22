# Hydrogen upgrade guide: 2025.1.1 to 2026.4.1

----

## Breaking changes

### Migrate to React Router 7.9.x [#3141](https://github.com/Shopify/hydrogen/pull/3141)

#### Step: 1. Run the automated migration codemod [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> This codemod will automatically update most imports and references from Remix to React Router
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
npx codemod@latest remix/2/react-router/upgrade
```


#### Step: 2. Create react-router.config.ts with hydrogenPreset [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Create your React Router configuration file using Hydrogen's optimized preset. This enhances routing and build performance.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```typescript
// react-router.config.ts
import type {Config} from "@react-router/dev/config";
import {hydrogenPreset} from "@shopify/hydrogen/react-router-preset";

export default {
  presets: [hydrogenPreset()],
} satisfies Config;
```


#### Step: 3. Update vite.config.ts to use React Router plugin [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace the Remix Vite plugin with React Router's plugin. Add vite-tsconfig-paths for better path resolution.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
// vite.config.ts
import {defineConfig} from 'vite';
- import {vitePlugin as remix} from '@remix-run/dev';
+ import {reactRouter} from '@react-router/dev/vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
+ import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
+   hydrogen(),
+   oxygen(),
+   reactRouter(),
+   tsconfigPaths()
-   remix({
-     presets: [hydrogen.preset()],
-   }),
  ],
});
```


#### Step: 4. Update tsconfig.json for React Router type generation [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Update your TypeScript configuration to include React Router's generated types. This optimizes type checking.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
// tsconfig.json
{
  "include": [
    "env.d.ts",
    "app/**/*.ts",
    "app/**/*.tsx",
+   "app/**/*.d.ts",
+   "*.ts",
+   "*.tsx",
+   "*.d.ts",
+   ".graphqlrc.ts",
+   ".react-router/types/**/*"
-   "**/*.ts",
-   "**/*.tsx"
  ],
  "compilerOptions": {
    "types": [
      "@shopify/oxygen-workers-types",
+     "react-router",
+     "@shopify/hydrogen/react-router-types",
+     "vite/client"
-     "@remix-run/node",
-     "vite/client"
    ],
+   "rootDirs": [".", "./.react-router/types"],
    "baseUrl": ".",
    "paths": {
      "~/*": ["app/*"]
    }
  }
}
```


#### Step: 5. Create app/lib/context.ts with createHydrogenRouterContext [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Create a new context file that exports the createHydrogenRouterContext function. This supports additional context properties and type augmentation.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```typescript
// app/lib/context.ts
import {createHydrogenContext} from '@shopify/hydrogen';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';

const additionalContext = {
  // Additional context for custom properties, CMS clients, 3P SDKs, etc.
} as const;

type AdditionalContextType = typeof additionalContext;

declare global {
  interface HydrogenAdditionalContext extends AdditionalContextType {}
}

export async function createHydrogenRouterContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      i18n: {language: 'EN', country: 'US'},
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
      },
    },
    additionalContext,
  );

  return hydrogenContext;
}
```


#### Step: 6. Update server.ts to use createHydrogenRouterContext [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace @shopify/remix-oxygen with @shopify/hydrogen/oxygen. Use the new context creation function with session handling.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
// server.ts
- import {createRequestHandler} from "@shopify/remix-oxygen";
+ import {createRequestHandler} from "@shopify/hydrogen/oxygen";
+ import {createHydrogenRouterContext} from "~/lib/context";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
+   const hydrogenContext = await createHydrogenRouterContext(
+     request,
+     env,
+     executionContext,
+   );

    const handleRequest = createRequestHandler({
-     build: await import('virtual:remix/server-build'),
+     build: await import('virtual:react-router/server-build'),
      mode: process.env.NODE_ENV,
-     getLoadContext: () => ({...}),
+     getLoadContext: () => hydrogenContext,
    });

    const response = await handleRequest(request);
+
+   if (hydrogenContext.session.isPending) {
+     response.headers.set('Set-Cookie', await hydrogenContext.session.commit());
+   }

    return response;
  }
};
```


#### Step: 7. Update entry.server.tsx with new context types [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace Remix types with React Router types. Use HydrogenRouterContextProvider for better type safety.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
// app/entry.server.tsx
- import type {AppLoadContext} from "@shopify/remix-oxygen";
- import type {EntryContext} from "@remix-run/server-runtime";
+ import type {EntryContext} from "react-router";
import {
  createContentSecurityPolicy,
+ type HydrogenRouterContextProvider,
} from "@shopify/hydrogen";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
- remixContext: EntryContext,
+ reactRouterContext: EntryContext,
- context: AppLoadContext,
+ context: HydrogenRouterContextProvider,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({...});

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
-       context={remixContext}
+       context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
  );
}
```


#### Step: 8. Update entry.client.tsx with NonceProvider and HydratedRouter [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace RemixBrowser with HydratedRouter. Wrap with NonceProvider for CSP support during client-side hydration.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
// app/entry.client.tsx
- import {RemixBrowser} from "@remix-run/react";
+ import {HydratedRouter} from "react-router/dom";
import {startTransition, StrictMode} from "react";
import {hydrateRoot} from "react-dom/client";
+ import {NonceProvider} from "@shopify/hydrogen";

if (!window.location.origin.includes("webcache.googleusercontent.com")) {
  startTransition(() => {
+   const existingNonce = document
+     .querySelector<HTMLScriptElement>("script[nonce]")
+     ?.nonce;
+
    hydrateRoot(
      document,
      <StrictMode>
-       <RemixBrowser />
+       <NonceProvider value={existingNonce}>
+         <HydratedRouter />
+       </NonceProvider>
      </StrictMode>,
    );
  });
}
```


#### Step: 9. Update @shopify/remix-oxygen imports in route files [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace @shopify/remix-oxygen imports with react-router equivalents in your routes
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
- import {redirect, type LoaderFunctionArgs} from "@shopify/remix-oxygen";
+ import {redirect} from "react-router";
+ import type {LoaderFunctionArgs} from "@shopify/hydrogen/oxygen";
```


#### Step: 10. Update @remix-run/react imports in route files [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Replace @remix-run/react imports with react-router equivalents in your routes
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
- import {useLoaderData, type MetaFunction} from "@remix-run/react";
+ import {useLoaderData} from "react-router";
```


#### Step: 11. Add React Router 7 route type imports [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Import route-specific types from React Router 7's new type generation system
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
+ import type {Route} from "./+types/route-name";
```


#### Step: 12. Add .react-router to .gitignore [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> React Router 7 generates type files that should not be committed to version control
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
echo ".react-router/" >> .gitignore
```


#### Step: 13. Update package.json scripts to use react-router typegen [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Add React Router type generation to your dev script. This automatically updates types during development.
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
- "dev": "shopify hydrogen dev --codegen",
+ "dev": "react-router typegen --watch && shopify hydrogen dev --codegen",
```


#### Step: 14. Verify your app starts and builds correctly [#3141](https://github.com/Shopify/hydrogen/pull/3141)

> Test that your application runs without errors after the migration
[#3141](https://github.com/Shopify/hydrogen/pull/3141)
```diff
npm run dev
npm run build
```


----

## Features

### Migrate to Shopify's new cookie system [#3309](https://github.com/Shopify/hydrogen/pull/3309)

#### Step: 1. Understand the new cookie model and compatibility story [#3309](https://github.com/Shopify/hydrogen/pull/3309)

> Shopify is deprecating `_shopify_y` and `_shopify_s` in favor of `_shopify_analytics` and `_shopify_marketing`, which are http-only cookies set via the Storefront API on your storefront domain. Hydrogen now reads and writes these cookies through a Storefront API proxy while still honoring the legacy cookies when present. You don't need to migrate values manually, but you must ensure that requests flow through the proxy so cookies are set before analytics run.
[#3309](https://github.com/Shopify/hydrogen/pull/3309)

#### Step: 2. Set up a Storefront API proxy for your deployment [#3309](https://github.com/Shopify/hydrogen/pull/3309)

> Depending on how you host your app, you must ensure Storefront API calls go through a proxy on your storefront domain.
[#3309](https://github.com/Shopify/hydrogen/pull/3309)
### React Router + Hydrogen on Oxygen

If you scaffolded from the default Hydrogen skeleton and deploy to Oxygen, the `createRequestHandler` utility from `@shopify/hydrogen/oxygen` (now also exported from `@shopify/hydrogen`) already sets up a Storefront API proxy on the same domain as your storefront.

**In most cases, no changes are required**; just confirm your server entry still uses it:

```ts
// server.ts (Oxygen)
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

export default {
  async fetch(request, env) {
    const hydrogenContext = createHydrogenContext({
      env,
      request,
      /* ... */
    });

    const handleRequest = createRequestHandler({
      /* ... */
      getLoadContext: () => hydrogenContext,
      // Alternatively, pass at least storefront client:
      // getLoadContext: () => ({storefront: createStorefrontClient(...)})
    });

    return handleRequest(request);
  },
};
```

Keep using `<Analytics.Provider>` component or `useCustomerPrivacy` hook to get cookies in the browser automatically.

For a full example, refer to our [skeleton template](https://github.com/Shopify/hydrogen/blob/main/templates/skeleton/server.ts).

### React Router + Hydrogen on other hosts

#### Hosts that support Web Fetch API (Request/Response)

On hosts that support the standard Web Fetch API (Workers-style environments), import `createRequestHandler` from `@shopify/hydrogen` (instead of `react-router`) and route requests through it:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

const hydrogenContext = createHydrogenContext({
  /* ... */
});

const handleRequest = createRequestHandler({
  /* ... */
  getLoadContext: () => hydrogenContext,
});
```

#### Node.js and other hosts

For Node-like environments, adapt Node requests to Fetch with [`@remix-run/node-fetch-server`](https://www.npmjs.com/package/@remix-run/node-fetch-server), then delegate to Hydrogen's handler:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';
import {createRequestListener} from '@remix-run/node-fetch-server';
import http from 'http';

const handleNodeRequest = createRequestListener((request) => {
  const hydrogenContext = createHydrogenContext({
    /* ... */
  });

  const handleWebRequest = createRequestHandler({
    /* ... */
    getLoadContext: () => hydrogenContext,
  });

  return handleWebRequest(request);
});

http.createServer(handleNodeRequest);
```

Alternatively, if you can't delegate to Hydrogen's `createRequestHandler`, you can provide a custom Storefront API proxy in your server. See [Hydrogen's implementation](https://github.com/Shopify/hydrogen/blob/27066a28577484f406222116a959eb463d255685/packages/hydrogen/src/storefront.ts#L546-L611) as a reference. In this case, ensure you manually pass `sameDomainForStorefrontApi: true` in the `consent` object for `<Analytics.Provider>` or as a prop to the `useCustomerPrivacy` hook.


### Improve development cold start time with static server build import [#3331](https://github.com/Shopify/hydrogen/pull/3331)

#### Step: 1. Update server.ts to use static import [#3331](https://github.com/Shopify/hydrogen/pull/3331)

> Replace the dynamic import with a static import at the top of the file.
[#3331](https://github.com/Shopify/hydrogen/pull/3331)
```diff
// server.ts

+import * as serverBuild from 'virtual:react-router/server-build';

const handleRequest = createRequestHandler({
-  build: await import('virtual:react-router/server-build'),
+  build: serverBuild,
   mode: process.env.NODE_ENV,
   getLoadContext: () => hydrogenContext,
});

// This change improves cold start time in development (2s => 200ms)
```


#### Step: 2. Update ESLint config to allow virtual: imports [#3331](https://github.com/Shopify/hydrogen/pull/3331)

> Add the virtual: prefix to the import/no-unresolved ignore list.
[#3331](https://github.com/Shopify/hydrogen/pull/3331)
```diff
// eslint.config.js

rules: {
+  'import/no-unresolved': ['error', {ignore: ['^virtual:']}],
}

// Allows virtual: imports used by React Router
```


### React Router 7.12 stabilized APIs [#3346](https://github.com/Shopify/hydrogen/pull/3346)

#### Step: 1. Update fetcher reset calls [#3346](https://github.com/Shopify/hydrogen/pull/3346)

> The `fetcher.unstable_reset()` method is now stable as `fetcher.reset()`. Update any usages in your code.
[#3346](https://github.com/Shopify/hydrogen/pull/3346)
```diff
- fetcher.unstable_reset()
+ fetcher.reset()
```


#### Step: 2. Update RouterProvider onError prop [#3346](https://github.com/Shopify/hydrogen/pull/3346)

> The `unstable_onError` prop on `<RouterProvider>` and `<HydratedRouter>` is now stable as `onError`. Update any usages in your code.
[#3346](https://github.com/Shopify/hydrogen/pull/3346)
```diff
// For RouterProvider
- <RouterProvider unstable_onError={handleError} />
+ <RouterProvider onError={handleError} />

// For HydratedRouter
- <HydratedRouter unstable_onError={handleError} />
+ <HydratedRouter onError={handleError} />
```


### Add countryCode parameter to Customer Account API methods [#3148](https://github.com/Shopify/hydrogen/pull/3148)

#### Add countryCode parameter to Customer Account API method calls
> Pass the customer account country code to any Customer Account API method. See login method example.
[#3148](https://github.com/Shopify/hydrogen/pull/3148)
```diff
// app/routes/account_.login.tsx (example)
export async function loader({request, context}: Route.LoaderArgs) {
  return context.customerAccount.login({
+   countryCode: context.customerAccount.i18n.country,
  });
}

// The countryCode parameter is now available on all Customer Account API methods
// and can be passed from context.customerAccount.i18n.country
```


### Remove individual gift cards from cart [#3128](https://github.com/Shopify/hydrogen/pull/3128)

#### Step: 1. Add GiftCardCodesRemove case to cart action handler [#3128](https://github.com/Shopify/hydrogen/pull/3128)

> Handle the new GiftCardCodesRemove action in your cart route. This enables individual gift card removal.
[#3128](https://github.com/Shopify/hydrogen/pull/3128)
```diff
// app/routes/cart.tsx
export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;
  const formData = await request.formData();
  const {action, inputs} = CartForm.getFormInput(formData);

  switch (action) {
    // ... existing cases ...
+   case CartForm.ACTIONS.GiftCardCodesRemove: {
+     const appliedGiftCardIds = inputs.giftCardCodes as string[];
+     result = await cart.removeGiftCardCodes(appliedGiftCardIds);
+     break;
+   }
  }
}
```


#### Step: 2. Add RemoveGiftCardForm component [#3128](https://github.com/Shopify/hydrogen/pull/3128)

> Create a new form component to handle individual gift card removal
[#3128](https://github.com/Shopify/hydrogen/pull/3128)
```diff
// app/components/CartSummary.tsx
+function RemoveGiftCardForm({
+  giftCardId,
+  children,
+}: {
+  giftCardId: string;
+  children: React.ReactNode;
+}) {
+  return (
+    <CartForm
+      route="/cart"
+      action={CartForm.ACTIONS.GiftCardCodesRemove}
+      inputs={{
+        giftCardCodes: [giftCardId],
+      }}
+    >
+      {children}
+    </CartForm>
+  );
+}
```


#### Step: 3. Update CartGiftCard to display gift cards with remove buttons [#3128](https://github.com/Shopify/hydrogen/pull/3128)

> Render applied gift cards with individual remove buttons. This improves user experience.
[#3128](https://github.com/Shopify/hydrogen/pull/3128)
```diff
// app/components/CartSummary.tsx
function CartGiftCard({giftCardCodes}: {...}) {
  return (
    <div>
+     {giftCardCodes && giftCardCodes.length > 0 && (
+       <dl>
+         <dt>Applied Gift Card(s)</dt>
+         {giftCardCodes.map((giftCard) => (
+           <RemoveGiftCardForm key={giftCard.id} giftCardId={giftCard.id}>
+             <div className="cart-discount">
+               <code>***{giftCard.lastCharacters}</code>
+               <Money data={giftCard.amountUsed} />
+               <button type="submit">Remove</button>
+             </div>
+           </RemoveGiftCardForm>
+         ))}
+       </dl>
+     )}
    </div>
  );
}
```


### Filter customer orders by number and confirmation [#3125](https://github.com/Shopify/hydrogen/pull/3125)

#### Step: 1. Create app/lib/orderFilters.ts utility [#3125](https://github.com/Shopify/hydrogen/pull/3125)

> Create helper functions to parse URL parameters and build Customer Account API search queries.
[#3125](https://github.com/Shopify/hydrogen/pull/3125)
```typescript
// app/lib/orderFilters.ts
export const ORDER_FILTER_FIELDS = {
  NAME: 'name',
  CONFIRMATION_NUMBER: 'confirmation_number',
} as const;

export interface OrderFilterParams {
  name?: string;
  confirmationNumber?: string;
}

function sanitizeFilterValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function buildOrderSearchQuery(
  filters: OrderFilterParams,
): string | undefined {
  const queryParts: string[] = [];

  if (filters.name) {
    const cleanName = filters.name.replace(/^#/, '').trim();
    const sanitizedName = sanitizeFilterValue(cleanName);
    if (sanitizedName) {
      queryParts.push(`name:${sanitizedName}`);
    }
  }

  if (filters.confirmationNumber) {
    const cleanConfirmation = filters.confirmationNumber.trim();
    const sanitizedConfirmation = sanitizeFilterValue(cleanConfirmation);
    if (sanitizedConfirmation) {
      queryParts.push(`confirmation_number:${sanitizedConfirmation}`);
    }
  }

  return queryParts.length > 0 ? queryParts.join(' AND ') : undefined;
}

export function parseOrderFilters(
  searchParams: URLSearchParams,
): OrderFilterParams {
  const filters: OrderFilterParams = {};

  const name = searchParams.get(ORDER_FILTER_FIELDS.NAME);
  if (name) filters.name = name;

  const confirmationNumber = searchParams.get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER);
  if (confirmationNumber) filters.confirmationNumber = confirmationNumber;

  return filters;
}
```


#### Step: 2. Update loader to parse filters and build search query [#3125](https://github.com/Shopify/hydrogen/pull/3125)

> Parse URL search parameters and build the Customer Account API query string.
[#3125](https://github.com/Shopify/hydrogen/pull/3125)
```diff
// app/routes/account.orders._index.tsx
+import {
+  buildOrderSearchQuery,
+  parseOrderFilters,
+  type OrderFilterParams,
+} from '~/lib/orderFilters';

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

+ const url = new URL(request.url);
+ const filters = parseOrderFilters(url.searchParams);
+ const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
+     query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

- return {customer: data.customer};
+ return {customer: data.customer, filters};
}
```


#### Step: 3. Add OrderSearchForm component [#3125](https://github.com/Shopify/hydrogen/pull/3125)

> Create a search form with order number and confirmation number inputs
[#3125](https://github.com/Shopify/hydrogen/pull/3125)
```diff
// app/routes/account.orders._index.tsx
+import {useSearchParams, useNavigation} from 'react-router';
+import {useRef} from 'react';
+import {ORDER_FILTER_FIELDS} from '~/lib/orderFilters';

+function OrderSearchForm({currentFilters}: {currentFilters: OrderFilterParams}) {
+  const [searchParams, setSearchParams] = useSearchParams();
+  const navigation = useNavigation();
+  const isSearching = navigation.state !== 'idle' && navigation.location?.pathname?.includes('orders');
+  const formRef = useRef<HTMLFormElement>(null);
+
+  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
+    event.preventDefault();
+    const formData = new FormData(event.currentTarget);
+    const params = new URLSearchParams();
+
+    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
+    const confirmationNumber = formData.get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)?.toString().trim();
+
+    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
+    if (confirmationNumber) params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);
+
+    setSearchParams(params);
+  };
+
+  return (
+    <form ref={formRef} onSubmit={handleSubmit}>
+      <input type="search" name={ORDER_FILTER_FIELDS.NAME} placeholder="Order #" defaultValue={currentFilters.name || ''} />
+      <input type="search" name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER} placeholder="Confirmation #" defaultValue={currentFilters.confirmationNumber || ''} />
+      <button type="submit" disabled={isSearching}>{isSearching ? 'Searching' : 'Search'}</button>
+    </form>
+  );
+}
```


#### Step: 4. Update Orders component to use filters and add EmptyOrders [#3125](https://github.com/Shopify/hydrogen/pull/3125)

> Pass filters to components and add conditional empty state messaging.
[#3125](https://github.com/Shopify/hydrogen/pull/3125)
```diff
// app/routes/account.orders._index.tsx
export default function Orders() {
- const {customer} = useLoaderData<OrdersLoaderData>();
+ const {customer, filters} = useLoaderData<OrdersLoaderData>();
  const {orders} = customer;

  return (
    <div className="orders">
+     <OrderSearchForm currentFilters={filters} />
-     <OrdersTable orders={orders} />
+     <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

-function OrdersTable({orders}: {orders: CustomerOrdersFragment['orders']}) {
+function OrdersTable({orders, filters}: {orders: CustomerOrdersFragment['orders']; filters: OrderFilterParams}) {
+  const hasFilters = !!(filters.name || filters.confirmationNumber);
+
  return (
    <div>
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders}>
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
-       <p>You haven't placed any orders yet.</p>
+       <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

+function EmptyOrders({hasFilters}: {hasFilters?: boolean}) {
+  return hasFilters ? (
+    <p>No orders found matching your search. <Link to="/account/orders">Clear filters</Link></p>
+  ) : (
+    <p>You haven't placed any orders yet.</p>
+  );
+}
```


### Get order fulfillment status from Customer Account API [#3039-fulfillment](https://github.com/Shopify/hydrogen/pull/3039)

#### Add fulfillmentStatus field to Order fragment
> Include fulfillmentStatus in your Customer Account API order queries.
[#3039-fulfillment](https://github.com/Shopify/hydrogen/pull/3039)
```diff
// app/graphql/customer-account/CustomerOrderQuery.ts
fragment Order on Order {
  id
  name
  confirmationNumber
  statusPageUrl
+ fulfillmentStatus
  processedAt
  fulfillments(first: 1) {
    nodes {
      status
    }
  }
}
```


### Use language context in Customer Account API mutations [#3039-incontext](https://github.com/Shopify/hydrogen/pull/3039)

#### Add @inContext directive to all Customer Account API operations
> Add $language parameter and @inContext directive to your queries and mutations for localized content.
[#3039-incontext](https://github.com/Shopify/hydrogen/pull/3039)
```diff
// app/graphql/customer-account/*.ts (apply to all queries and mutations)
// Example: CustomerDetailsQuery.ts
- query CustomerDetails {
+ query CustomerDetails($language: LanguageCode) @inContext(language: $language) {
    customer {
      ...Customer
    }
  }

// Example: CustomerAddressMutations.ts  
  mutation CustomerAddressUpdate(
    $address: MailingAddressInput!
    $addressId: ID!
    $defaultAddress: Boolean
+   $language: LanguageCode
- ) {
+ ) @inContext(language: $language) {
    customerAddressUpdate(...)
  }

// Apply this pattern to all Customer Account API queries and mutations:
// - CustomerDetailsQuery.ts
// - CustomerOrderQuery.ts
// - CustomerOrdersQuery.ts
// - CustomerUpdateMutation.ts
// - CustomerAddressMutations.ts (all 3 mutations)
```


### Defer non-critical fields with GraphQL @defer directive [#2993](https://github.com/Shopify/hydrogen/pull/2993)

#### Use @defer directive in Storefront API queries
> Wrap non-critical fields with @defer. This improves initial page load performance.
[#2993](https://github.com/Shopify/hydrogen/pull/2993)
```diff
// app/routes/your-route.tsx (example)
+import {LoaderFunctionArgs, useLoaderData} from 'react-router';

export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(
    `
  query ProductQuery($handle: String) {
    product(handle: $handle) {
      id
      handle
+     ... @defer(label: "deferredFields") {
+       title
+       description
+     }
    }
  }
`,
    {
      variables: {
        handle: 'v2-snowboard',
      },
    },
  );
  return data;
}

// The @defer directive allows you to defer loading of non-critical fields
// improving initial page load performance
```


### Migrate to Shopify's new cookie system [#3350](https://github.com/Shopify/hydrogen/pull/3350)

#### Step: 1. Understand the new cookie model and compatibility story [#3350](https://github.com/Shopify/hydrogen/pull/3350)

> Shopify is deprecating `_shopify_y` and `_shopify_s` in favor of `_shopify_analytics` and `_shopify_marketing`, which are http-only cookies set via the Storefront API on your storefront domain. Hydrogen now reads and writes these cookies through a Storefront API proxy while still honoring the legacy cookies when present. You don't need to migrate values manually, but you must ensure that requests flow through the proxy so cookies are set before analytics run.
[#3350](https://github.com/Shopify/hydrogen/pull/3350)

#### Step: 2. Set up a Storefront API proxy for your deployment [#3350](https://github.com/Shopify/hydrogen/pull/3350)

> Depending on how you host your app, you must ensure Storefront API calls go through a proxy on your storefront domain.
[#3350](https://github.com/Shopify/hydrogen/pull/3350)
### React Router + Hydrogen on Oxygen

If you scaffolded from the default Hydrogen skeleton and deploy to Oxygen, the `createRequestHandler` utility from `@shopify/hydrogen/oxygen` (now also exported from `@shopify/hydrogen`) already sets up a Storefront API proxy on the same domain as your storefront.

**In most cases, no changes are required**; just confirm your server entry still uses it:

```ts
// server.ts (Oxygen)
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

export default {
  async fetch(request, env) {
    const hydrogenContext = createHydrogenContext({
      env,
      request,
      /* ... */
    });

    const handleRequest = createRequestHandler({
      /* ... */
      getLoadContext: () => hydrogenContext,
      // Alternatively, pass at least storefront client:
      // getLoadContext: () => ({storefront: createStorefrontClient(...)})
    });

    return handleRequest(request);
  },
};
```

Keep using `<Analytics.Provider>` component or `useCustomerPrivacy` hook to get cookies in the browser automatically.

For a full example, refer to our [skeleton template](https://github.com/Shopify/hydrogen/blob/main/templates/skeleton/server.ts).

### React Router + Hydrogen on other hosts

#### Hosts that support Web Fetch API (Request/Response)

On hosts that support the standard Web Fetch API (Workers-style environments), import `createRequestHandler` from `@shopify/hydrogen` (instead of `react-router`) and route requests through it:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

const hydrogenContext = createHydrogenContext({
  /* ... */
});

const handleRequest = createRequestHandler({
  /* ... */
  getLoadContext: () => hydrogenContext,
});
```

#### Node.js and other hosts

For Node-like environments, adapt Node requests to Fetch with [`@remix-run/node-fetch-server`](https://www.npmjs.com/package/@remix-run/node-fetch-server), then delegate to Hydrogen's handler:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';
import {createRequestListener} from '@remix-run/node-fetch-server';
import http from 'http';

const handleNodeRequest = createRequestListener((request) => {
  const hydrogenContext = createHydrogenContext({
    /* ... */
  });

  const handleWebRequest = createRequestHandler({
    /* ... */
    getLoadContext: () => hydrogenContext,
  });

  return handleWebRequest(request);
});

http.createServer(handleNodeRequest);
```

Alternatively, if you can't delegate to Hydrogen's `createRequestHandler`, you can provide a custom Storefront API proxy in your server. See [Hydrogen's implementation](https://github.com/Shopify/hydrogen/blob/27066a28577484f406222116a959eb463d255685/packages/hydrogen/src/storefront.ts#L546-L611) as a reference. In this case, ensure you manually pass `sameDomainForStorefrontApi: true` in the `consent` object for `<Analytics.Provider>` or as a prop to the `useCustomerPrivacy` hook.


### Migrate to Shopify's new cookie system [#3332](https://github.com/Shopify/hydrogen/pull/3332)

#### Step: 1. Understand the new cookie model and compatibility story [#3332](https://github.com/Shopify/hydrogen/pull/3332)

> Shopify is deprecating `_shopify_y` and `_shopify_s` in favor of `_shopify_analytics` and `_shopify_marketing`, which are http-only cookies set via the Storefront API on your storefront domain. Hydrogen now reads and writes these cookies through a Storefront API proxy while still honoring the legacy cookies when present. You don't need to migrate values manually, but you must ensure that requests flow through the proxy so cookies are set before analytics run.
[#3332](https://github.com/Shopify/hydrogen/pull/3332)

#### Step: 2. Set up a Storefront API proxy for your deployment [#3332](https://github.com/Shopify/hydrogen/pull/3332)

> Depending on how you host your app, you must ensure Storefront API calls go through a proxy on your storefront domain.
[#3332](https://github.com/Shopify/hydrogen/pull/3332)
### Remix + Hydrogen on Oxygen

If you scaffolded from the default Hydrogen skeleton and deploy to Oxygen, the `createRequestHandler` utility from `@shopify/remix-oxygen` already sets up a Storefront API proxy on the same domain as your storefront.

**In most cases, no changes are required**; just confirm your server entry still uses it:

```ts
// server.ts (Oxygen)
import {createRequestHandler} from '@shopify/remix-oxygen';
import {createHydrogenContext} from '@shopify/hydrogen';

export default {
  async fetch(request, env) {
    const hydrogenContext = createHydrogenContext({
      env,
      request,
      /* ... */
    });

    const handleRequest = createRequestHandler({
      /* ... */
      getLoadContext: () => hydrogenContext,
    });

    return handleRequest(request);
  },
};
```

Keep using `<Analytics.Provider>` component or `useCustomerPrivacy` hook to get cookies in the browser automatically.

For a full example, refer to your skeleton template's server.ts.

### Remix + Hydrogen on other hosts

#### Hosts that support Web Fetch API (Request/Response)

On hosts that support the standard Web Fetch API (Workers-style environments), import `createRequestHandler` from `@shopify/hydrogen` and route requests through it:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

const hydrogenContext = createHydrogenContext({
  /* ... */
});

const handleRequest = createRequestHandler({
  /* ... */
  getLoadContext: () => hydrogenContext,
});
```

#### Node.js and other hosts

For Node-like environments, adapt Node requests to Fetch with [`@remix-run/node-fetch-server`](https://www.npmjs.com/package/@remix-run/node-fetch-server), then delegate to Hydrogen's handler:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';
import {createRequestListener} from '@remix-run/node-fetch-server';
import http from 'http';

const handleNodeRequest = createRequestListener((request) => {
  const hydrogenContext = createHydrogenContext({
    /* ... */
  });

  const handleWebRequest = createRequestHandler({
    /* ... */
    getLoadContext: () => hydrogenContext,
  });

  return handleWebRequest(request);
});

http.createServer(handleNodeRequest);
```

Alternatively, if you can't delegate to Hydrogen's `createRequestHandler`, you can provide a custom Storefront API proxy in your server. See [Hydrogen's implementation](https://github.com/Shopify/hydrogen/blob/27066a28577484f406222116a959eb463d255685/packages/hydrogen/src/storefront.ts#L546-L611) as a reference. In this case, ensure you manually pass `sameDomainForStorefrontApi: true` in the `consent` object for `<Analytics.Provider>` or as a prop to the `useCustomerPrivacy` hook.


### Migrate to Shopify's new cookie system [#3354](https://github.com/Shopify/hydrogen/pull/3354)

#### Step: 1. Understand the new cookie model and compatibility story [#3354](https://github.com/Shopify/hydrogen/pull/3354)

> Shopify is deprecating `_shopify_y` and `_shopify_s` in favor of `_shopify_analytics` and `_shopify_marketing`, which are http-only cookies set via the Storefront API on your storefront domain. Hydrogen now reads and writes these cookies through a Storefront API proxy while still honoring the legacy cookies when present. You don't need to migrate values manually, but you must ensure that requests flow through the proxy so cookies are set before analytics run.
[#3354](https://github.com/Shopify/hydrogen/pull/3354)

#### Step: 2. Set up a Storefront API proxy for your deployment [#3354](https://github.com/Shopify/hydrogen/pull/3354)

> Depending on how you host your app, you must ensure Storefront API calls go through a proxy on your storefront domain.
[#3354](https://github.com/Shopify/hydrogen/pull/3354)
### Remix + Hydrogen on Oxygen

If you scaffolded from the default Hydrogen skeleton and deploy to Oxygen, the `createRequestHandler` utility from `@shopify/remix-oxygen` already sets up a Storefront API proxy on the same domain as your storefront.

**In most cases, no changes are required**; just confirm your server entry still uses it:

```ts
// server.ts (Oxygen)
import {createRequestHandler} from '@shopify/remix-oxygen';
import {createHydrogenContext} from '@shopify/hydrogen';

export default {
  async fetch(request, env) {
    const hydrogenContext = createHydrogenContext({
      env,
      request,
      /* ... */
    });

    const handleRequest = createRequestHandler({
      /* ... */
      getLoadContext: () => hydrogenContext,
    });

    return handleRequest(request);
  },
};
```

Keep using `<Analytics.Provider>` component or `useCustomerPrivacy` hook to get cookies in the browser automatically.

For a full example, refer to your skeleton template's server.ts.

### Remix + Hydrogen on other hosts

#### Hosts that support Web Fetch API (Request/Response)

On hosts that support the standard Web Fetch API (Workers-style environments), import `createRequestHandler` from `@shopify/hydrogen` and route requests through it:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';

const hydrogenContext = createHydrogenContext({
  /* ... */
});

const handleRequest = createRequestHandler({
  /* ... */
  getLoadContext: () => hydrogenContext,
});
```

#### Node.js and other hosts

For Node-like environments, adapt Node requests to Fetch with [`@remix-run/node-fetch-server`](https://www.npmjs.com/package/@remix-run/node-fetch-server), then delegate to Hydrogen's handler:

```ts
import {createRequestHandler, createHydrogenContext} from '@shopify/hydrogen';
import {createRequestListener} from '@remix-run/node-fetch-server';
import http from 'http';

const handleNodeRequest = createRequestListener((request) => {
  const hydrogenContext = createHydrogenContext({
    /* ... */
  });

  const handleWebRequest = createRequestHandler({
    /* ... */
    getLoadContext: () => hydrogenContext,
  });

  return handleWebRequest(request);
});

http.createServer(handleNodeRequest);
```

Alternatively, if you can't delegate to Hydrogen's `createRequestHandler`, you can provide a custom Storefront API proxy in your server. See [Hydrogen's implementation](https://github.com/Shopify/hydrogen/blob/27066a28577484f406222116a959eb463d255685/packages/hydrogen/src/storefront.ts#L546-L611) as a reference. In this case, ensure you manually pass `sameDomainForStorefrontApi: true` in the `consent` object for `<Analytics.Provider>` or as a prop to the `useCustomerPrivacy` hook.


### Add support for `v3_routeConfig` future flag. [#2722](https://github.com/Shopify/hydrogen/pull/2722)

#### Step: 1. Update your `vite.config.ts`. [#2722](https://github.com/Shopify/hydrogen/pull/2722)

[docs](https://remix.run/docs/en/main/start/future-flags#v3_routeconfig)
[#2722](https://github.com/Shopify/hydrogen/pull/2722)
export default defineConfig({
 plugins: [
   hydrogen(),
   oxygen(),
   remix({
     presets: [hydrogen.v3preset()],  // Update this to hydrogen.v3preset()
     future: {
       v3_fetcherPersist: true,
       v3_relativeSplatPath: true,
       v3_throwAbortReason: true,
       v3_lazyRouteDiscovery: true,
       v3_singleFetch: true,
       v3_routeConfig: true, // add this flag
     },
   }),
   tsconfigPaths(),
 ],

#### Step: 2. Update your `package.json` and install the new packages. Make sure to match the Remix version along with other Remix npm packages and ensure the versions are 2.16.1 or above. [#2722](https://github.com/Shopify/hydrogen/pull/2722)

[docs](https://remix.run/docs/en/main/start/future-flags#v3_routeconfig)
[#2722](https://github.com/Shopify/hydrogen/pull/2722)
"devDependencies": {
  ...
  "@remix-run/fs-routes": "^2.16.1",
  "@remix-run/route-config": "^2.16.1",

#### Step: 3. Add a `routes.ts` file. This is your new Remix route configuration file. [#2722](https://github.com/Shopify/hydrogen/pull/2722)

[docs](https://remix.run/docs/en/main/start/future-flags#v3_routeconfig)
[#2722](https://github.com/Shopify/hydrogen/pull/2722)
import {flatRoutes} from '@remix-run/fs-routes';
import {type RouteConfig} from '@remix-run/route-config';
import {hydrogenRoutes} from '@shopify/hydrogen';

export default hydrogenRoutes([
  ...(await flatRoutes()),
  // Manual route definitions can be added to this array, in addition to or instead of using the `flatRoutes` file-based routing convention.
  // See https://remix.run/docs/en/main/guides/routing for more details
]) satisfies RouteConfig;

----

----

## Fixes

### Use stable Customer Account API development flag [#3082-flag](https://github.com/Shopify/hydrogen/pull/3082)

#### Update command to use stable flag
> Remove the __unstable suffix from the customer-account-push command
[#3082-flag](https://github.com/Shopify/hydrogen/pull/3082)
```diff
- shopify hydrogen customer-account-push__unstable [flags]
+ shopify hydrogen customer-account-push [flags]

// The --customer-account-push flag is now stable and no longer requires __unstable suffix
```


### Add TypeScript ESLint rules for promise handling [#3146](https://github.com/Shopify/hydrogen/pull/3146)

#### Add promise handling rules to ESLint config
> Enable no-floating-promises and no-misused-promises rules. These catch unhandled promises that cause deployment failures.
[#3146](https://github.com/Shopify/hydrogen/pull/3146)
```diff
// eslint.config.js
export default tseslint.config(
  {
    rules: {
      // ... existing rules ...
+     '@typescript-eslint/no-floating-promises': 'error',
+     '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);

// These rules prevent unhandled promises and promise misuse
// Helps avoid 'The script will never generate a response' errors on Oxygen/Cloudflare Workers
```


### Fix the customer account implementation to clear all session data on logout [#2843](https://github.com/Shopify/hydrogen/pull/2843)

#### You can opt out and keep custom data in the session by passing the `keepSession` option to logout
[#2843](https://github.com/Shopify/hydrogen/pull/2843)
```js
export async function action({context}: ActionFunctionArgs) {
  return context.customerAccount.logout({
    keepSession: true
  });
}
```

### Deprecate `<VariantSelector /> [#2837](https://github.com/Shopify/hydrogen/pull/2837)

#### Step: 1. Update the SFAPI product query to request the new required fields encodedVariantExistence and encodedVariantAvailability. This will allow the product form to determine which variants are available for selection. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
+    encodedVariantExistence
+    encodedVariantAvailability
    options {
      name
      optionValues {
        name
+        firstSelectableVariant {
+          ...ProductVariant
+        }
+        swatch {
+          color
+          image {
+            previewImage {
+              url
+            }
+          }
+        }
      }
    }
-    selectedVariant: selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
+    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
+      ...ProductVariant
+    }
+    adjacentVariants (selectedOptions: $selectedOptions) {
+      ...ProductVariant
+    }
-    variants(first: 1) {
-      nodes {
-        ...ProductVariant
-      }
-    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;
```

#### Step: 2. Remove the `VARIANTS_QUERY` and related logic from `loadDeferredData`, as querying all variants is no longer necessary. Simplifies the function to return an empty object. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
function loadDeferredData({context, params}: LoaderFunctionArgs) {
+  // Put any API calls that is not critical to be available on first page render
+  // For example: product reviews, product recommendations, social feeds.
-  // In order to show which variants are available in the UI, we need to query
-  // all of them. But there might be a *lot*, so instead separate the variants
-  // into it's own separate query that is deferred. So there's a brief moment
-  // where variant options might show as available when they're not, but after
-  // this deferred query resolves, the UI will update.
-  const variants = context.storefront
-    .query(VARIANTS_QUERY, {
-      variables: {handle: params.handle!},
-    })
-    .catch((error) => {
-      // Log query errors, but don't throw them so the page can still render
-      console.error(error);
-      return null;
-    });

+  return {}
-  return {
-    variants,
-  };
}
```

#### Step: 3. Update the `Product` component to use `getAdjacentAndFirstAvailableVariants` for determining the selected variant, improving handling of adjacent and available variants. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
+  getAdjacentAndFirstAvailableVariants,
} from '@shopify/hydrogen';

export default function Product() {
+  const {product} = useLoaderData<typeof loader>();
-  const {product, variants} = useLoaderData<typeof loader>();

+  // Optimistically selects a variant with given available variant information
+  const selectedVariant = useOptimisticVariant(
+    product.selectedOrFirstAvailableVariant,
+    getAdjacentAndFirstAvailableVariants(product),
+  );
-  const selectedVariant = useOptimisticVariant(
-    product.selectedVariant,
-    variants,
-  );
```

#### Step: 4. Automatically update the URL with search parameters based on the selected product variant's options when no search parameters are present, ensuring the URL reflects the current selection without triggering navigation. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getAdjacentAndFirstAvailableVariants,
+  mapSelectedProductOptionToObject,
} from '@shopify/hydrogen';

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

+  // Sets the search param to the selected variant without navigation
+  // only when no search params are set in the url
+  useEffect(() => {
+    const searchParams = new URLSearchParams(
+      mapSelectedProductOptionToObject(
+        selectedVariant.selectedOptions || [],
+      ),
+    );

+    if (window.location.search === '' && searchParams.toString() !== '') {
+      window.history.replaceState(
+        {},
+        '',
+        `${location.pathname}?${searchParams.toString()}`,
+      );
+    }
+  }, [
+    JSON.stringify(selectedVariant.selectedOptions),
+  ]);
```

#### Step: 5. Retrieve the product options array using `getProductOptions`, enabling efficient handling of product variants and their associated options. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
+  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  mapSelectedProductOptionToObject,
} from '@shopify/hydrogen';

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useEffect(() => {
    // ...
  }, [
    JSON.stringify(selectedVariant.selectedOptions),
  ]);

+  // Get the product options array
+  const productOptions = getProductOptions({
+    ...product,
+    selectedOrFirstAvailableVariant: selectedVariant,
+  });
```

#### Step: 6. Remove `Await` and `Suspense` from `ProductForm` as there are no longer any asynchronous queries to wait for, simplifying the component structure. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
export default function Product() {
  ...
  return (
    ...
+        <ProductForm
+          productOptions={productOptions}
+          selectedVariant={selectedVariant}
+        />
-        <Suspense
-          fallback={
-            <ProductForm
-              product={product}
-              selectedVariant={selectedVariant}
-              variants={[]}
-            />
-          }
-        >
-          <Await
-            errorElement="There was a problem loading product variants"
-            resolve={variants}
-          >
-            {(data) => (
-              <ProductForm
-                product={product}
-                selectedVariant={selectedVariant}
-                variants={data?.product?.variants.nodes || []}
-              />
-            )}
-          </Await>
-        </Suspense>
```

#### Step: 7. Refactor `ProductForm` to handle combined listing products and variants efficiently. It uses links for different product URLs and buttons for variant updates, improving SEO and user experience. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```tsx
import {Link, useNavigate} from '@remix-run/react';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

export function ProductForm({
  productOptions,
  selectedVariant,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  return (
    <div className="product-form">
      {productOptions.map((option) => (
        <div className="product-options" key={option.name}>
          <h5>{option.name}</h5>
          <div className="product-options-grid">
            {option.optionValues.map((value) => {
              const {
                name,
                handle,
                variantUriQuery,
                selected,
                available,
                exists,
                isDifferentProduct,
                swatch,
              } = value;

              if (isDifferentProduct) {
                // SEO
                // When the variant is a combined listing child product
                // that leads to a different URL, we need to render it
                // as an anchor tag
                return (
                  <Link
                    className="product-options-item"
                    key={option.name + name}
                    prefetch="intent"
                    preventScrollReset
                    replace
                    to={`/products/${handle}?${variantUriQuery}`}
                    style={{
                      border: selected
                        ? '1px solid black'
                        : '1px solid transparent',
                      opacity: available ? 1 : 0.3,
                    }}
                  >
                    <ProductOptionSwatch swatch={swatch} name={name} />
                  </Link>
                );
              } else {
                // SEO
                // When the variant is an update to the search param,
                // render it as a button with JavaScript navigating to
                // the variant so that SEO bots do not index these as
                // duplicated links
                return (
                  <button
                    type="button"
                    className={`product-options-item${
                      exists && !selected ? ' link' : ''
                    }`}
                    key={option.name + name}
                    style={{
                      border: selected
                        ? '1px solid black'
                        : '1px solid transparent',
                      opacity: available ? 1 : 0.3,
                    }}
                    disabled={!exists}
                    onClick={() => {
                      if (!selected) {
                        navigate(`?${variantUriQuery}`, {
                          replace: true,
                        });
                      }
                    }}
                  >
                    <ProductOptionSwatch swatch={swatch} name={name} />
                  </button>
                );
              }
            })}
          </div>
          <br />
        </div>
      ))}
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          open('cart');
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  selectedVariant,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptionSwatch({
  swatch,
  name,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}
```

#### Step: 8. Make `useVariantUrl` and `getVariantUrl` functions more flexible by allowing `selectedOptions` to be optional. This ensures compatibility with cases where no options are provided. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
export function useVariantUrl(
  handle: string,
-  selectedOptions: SelectedOption[],
+  selectedOptions?: SelectedOption[],
) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
    });
  }, [handle, selectedOptions, pathname]);
}
export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
}: {
  handle: string;
  pathname: string;
  searchParams: URLSearchParams;
-  selectedOptions: SelectedOption[];
+  selectedOptions?: SelectedOption[],
}) {
  const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
  const isLocalePathname = match && match.length > 0;
  const path = isLocalePathname
    ? `${match![0]}products/${handle}`
    : `/products/${handle}`;

-  selectedOptions.forEach((option) => {
+  selectedOptions?.forEach((option) => {
    searchParams.set(option.name, option.value);
  });
```

#### Step: 9. Remove unnecessary variant queries and references in `routes/collections.$handle.tsx`, simplifying the code by relying on the product route to fetch the first available variant. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
-    variants(first: 1) {
-      nodes {
-        selectedOptions {
-          name
-          value
-        }
-      }
-    }
  }
` as const;
```

and remove the variant reference

```diff
function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
-  const variant = product.variants.nodes[0];
-  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
+  const variantUrl = useVariantUrl(product.handle);
  return (
```

#### Step: 10. Simplify the `ProductItem` component by removing variant-specific queries and logic. The `useVariantUrl` function now generates URLs without relying on variant options, reducing complexity. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
-    variants(first: 1) {
-      nodes {
-        selectedOptions {
-          name
-          value
-        }
-      }
-    }
  }
` as const;
```

and remove the variant reference

```diff
function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
-  const variant = product.variants.nodes[0];
-  const variantUrl = useVariantUrl(product.handle, variant.selectedOptions);
+  const variantUrl = useVariantUrl(product.handle);
  return (
```

#### Step: 11. Replace `variants(first: 1)` with `selectedOrFirstAvailableVariant` in GraphQL fragments to directly fetch the most relevant variant, improving query efficiency and clarity. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
const SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment SearchProduct on Product {
    __typename
    handle
    id
    publishedAt
    title
    trackingParameters
    vendor
-    variants(first: 1) {
-      nodes {
+    selectedOrFirstAvailableVariant(
+      selectedOptions: []
+      ignoreUnknownOptions: true
+      caseInsensitiveMatch: true
+    ) {
        id
        image {
          url
          altText
          width
          height
        }
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
        product {
          handle
          title
        }
     }
-    }
  }
` as const;
```

```diff
const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
-    variants(first: 1) {
-      nodes {
+    selectedOrFirstAvailableVariant(
+      selectedOptions: []
+      ignoreUnknownOptions: true
+      caseInsensitiveMatch: true
+    ) {
        id
        image {
          url
          altText
          width
          height
        }
        price {
          amount
          currencyCode
        }
     }
-    }
  }
```

#### Step: 12. Refactor `SearchResultsProducts` to use `selectedOrFirstAvailableVariant` for fetching product price and image, simplifying the logic and improving performance. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <h2>Products</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });

+            const price = product?.selectedOrFirstAvailableVariant?.price;
+            const image = product?.selectedOrFirstAvailableVariant?.image;

            return (
              <div className="search-results-item" key={product.id}>
                <Link prefetch="intent" to={productUrl}>
-                  {product.variants.nodes[0].image && (
+                  {image && (
                    <Image
-                      data={product.variants.nodes[0].image}
+                      data={image}
                      alt={product.title}
                      width={50}
                    />
                  )}
                  <div>
                    <p>{product.title}</p>
                    <small>
-                      <Money data={product.variants.nodes[0].price} />
+                      {price &&
+                        <Money data={price} />
+                      }
                    </small>
                  </div>
                </Link>
              </div>
            );
          });
```

#### Step: 13. Update `SearchResultsPredictive` to use `selectedOrFirstAvailableVariant` for fetching product price and image, ensuring accurate and efficient data retrieval. [#2837](https://github.com/Shopify/hydrogen/pull/2837)

[#2837](https://github.com/Shopify/hydrogen/pull/2837)
```diff
function SearchResultsPredictiveProducts({
  term,
  products,
  closeSearch,
}: PartialPredictiveSearchResult<'products'>) {
  if (!products.length) return null;

  return (
    <div className="predictive-search-result" key="products">
      <h5>Products</h5>
      <ul>
        {products.map((product) => {
          const productUrl = urlWithTrackingParams({
            baseUrl: `/products/${product.handle}`,
            trackingParams: product.trackingParameters,
            term: term.current,
          });

+          const price = product?.selectedOrFirstAvailableVariant?.price;
-          const image = product?.variants?.nodes?.[0].image;
+          const image = product?.selectedOrFirstAvailableVariant?.image;
          return (
            <li className="predictive-search-result-item" key={product.id}>
              <Link to={productUrl} onClick={closeSearch}>
                {image && (
                  <Image
                    alt={image.altText ?? ''}
                    src={image.url}
                    width={50}
                    height={50}
                  />
                )}
                <div>
                  <p>{product.title}</p>
                  <small>
-                    {product?.variants?.nodes?.[0].price && (
+                    {price && (
-                      <Money data={product.variants.nodes[0].price} />
+                      <Money data={price} />
                    )}
                  </small>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```
