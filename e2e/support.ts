import {test as base, expect} from '@playwright/test';
import type {Page, Route} from '@playwright/test';
import {BYPASS_HEADER} from './env';
import he from '../app/lib/i18n/he.json' with {type: 'json'};
import en from '../app/lib/i18n/en.json' with {type: 'json'};

export {he, en};

export const PRODUCT_HANDLE = 'lightboard';
export const PRODUCT_PATH = `/products/${PRODUCT_HANDLE}`;
export const PRODUCT_PRICE = '279';

/** Fill a `{n}`-style i18n template. */
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    String(vars[k] ?? ''),
  );
}

/** Shopify checkout lives on the store / checkout domain, never on ours. */
export const CHECKOUT_URL_RE = /\/(checkouts|cart\/c)\//;

/** Same shape the real /api/photos/upload returns on success. */
export function mockUploadResponse() {
  const cdn = 'https://cdn.shopify.com/s/files/1/0000/0000/files';
  return {
    cropped: [0, 1, 2].map((i) => `${cdn}/e2e-cropped-${i}.jpg`),
    originals: [0, 1, 2].map((i) => `${cdn}/e2e-original-${i}.jpg`),
  };
}

type Fixtures = {
  /** Number of requests that reached the (mocked) photo upload endpoint. */
  uploadCalls: {count: number};
};

/**
 * Base test for browser specs. Requests to the storefront origin carry the
 * Oxygen auth bypass header when one is configured, and every page is
 * guarded so the live store is never written to by accident:
 *   - POST /api/photos/upload is fulfilled locally with a mocked success
 *     (it would otherwise write into Shopify Files);
 *   - the Shopify privacy banner, if shown, is declined so it can't cover
 *     the controls under test.
 */
export const test = base.extend<Fixtures>({
  context: async ({context, baseURL}, use) => {
    const token = process.env.OXYGEN_AUTH_BYPASS_TOKEN;
    if (token && baseURL) {
      const origin = new URL(baseURL).origin;
      await context.route(
        (url) => url.origin === origin,
        (route) =>
          route.continue({
            headers: {...route.request().headers(), [BYPASS_HEADER]: token},
          }),
      );
    }
    await use(context);
  },
  uploadCalls: async ({page}, use) => {
    const calls = {count: 0};
    await page.route('**/api/photos/upload', async (route: Route) => {
      calls.count += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUploadResponse()),
      });
    });
    await use(calls);
  },
  page: async ({page}, use) => {
    await page.addLocatorHandler(
      page.locator('#shopify-pc__banner'),
      async (banner) => {
        await banner
          .getByRole('button', {name: /decline|reject|דחי|סירוב/i})
          .first()
          .click();
      },
      {noWaitAfter: true},
    );
    await use(page);
  },
});

export {expect};

/** True when the target is `npm run dev` (Vite dev server), not a build. */
export async function isViteDevServer(page: Page) {
  return (await page.locator('script[src*="/@vite/client"]').count()) > 0;
}

/**
 * Wait until React has hydrated, so clicks hit live handlers instead of the
 * server-rendered markup.
 */
export async function waitForHydration(page: Page) {
  // hydrateRoot attaches a fiber to every server-rendered node it adopts.
  await page.waitForFunction(() => {
    const el =
      document.querySelector('main') ?? document.body.firstElementChild;
    return Boolean(
      el && Object.keys(el).some((k) => k.startsWith('__reactFiber')),
    );
  });
}

/**
 * Shortest path to a cart with one Lightboard: gallery photos (already on
 * the CDN, so nothing is uploaded) → approve → add to cart. Leaves the cart
 * drawer open.
 */
export async function addBoardToCart(page: Page) {
  const t = he.photoCustomizer;
  await page.goto(PRODUCT_PATH);
  await waitForHydration(page);
  await page.getByRole('button', {name: t.surprise.button}).click();
  await page.getByRole('button', {name: t.approve}).click();
  await expect(page.getByText(t.ready)).toBeVisible();
  // Wait for the real cart mutation, not just the optimistic line.
  const added = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/cart(\.data)?(\?|$)/.test(new URL(r.url()).pathname + '?'),
  );
  await page
    .locator('.product-buy')
    .getByRole('button', {name: new RegExp(he.product.addToCart)})
    .click();
  expect((await added).ok()).toBe(true);
  const drawer = page.getByRole('dialog', {name: he.aside.cart});
  await expect(
    drawer.getByRole('list', {name: he.cart.lineItems}).locator(':scope > li'),
  ).toHaveCount(1);
  return drawer;
}
