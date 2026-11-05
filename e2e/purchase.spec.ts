import {
  CHECKOUT_URL_RE,
  PRODUCT_PATH,
  PRODUCT_PRICE,
  expect,
  fill,
  he,
  test,
  waitForHydration,
} from './support';

const t = he.photoCustomizer;
const COLOR_OPTION = he.product.optionLabels.Color; // "צבע"
const COLOR_VALUE = 'Pink';
const COLOR_LABEL = he.product.optionValues[COLOR_VALUE]; // "ורוד"

/**
 * Happy path up to — and never past — Shopify checkout: home → PDP → color →
 * gallery photos → approve → add to cart → terms → checkout redirect.
 * The checkout navigation is aborted, so no checkout is ever opened.
 */
test('buy a Lightboard up to the checkout redirect', async ({
  page,
  uploadCalls,
}) => {
  await test.step('home has a single h1 and links to the product', async () => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      page.locator(`a[href^="${PRODUCT_PATH}"]`).first(),
    ).toBeAttached();
  });

  await test.step('open the product page', async () => {
    await page.goto(PRODUCT_PATH);
    await expect(page.locator('h1')).toHaveCount(1);
    await waitForHydration(page);
  });

  await test.step('pick a color', async () => {
    const colors = page.getByRole('radiogroup', {name: COLOR_OPTION});
    await expect(colors.getByRole('radio')).toHaveCount(3);
    const pink = colors.getByRole('radio', {name: COLOR_LABEL});
    await pink.click();
    await expect(pink).toHaveAttribute('aria-checked', 'true');
    await expect(page).toHaveURL(/Color=Pink/i);
  });

  const buy = page.locator('.product-buy');

  await test.step('add-to-cart explains what is missing', async () => {
    const pending = buy.getByRole('button', {
      name: fill(t.needPhotos, {n: 3}),
    });
    await expect(pending).toBeVisible();
    await expect(pending).toHaveAccessibleDescription(fill(t.progress, {n: 0}));
    await expect(
      buy.getByRole('button', {name: new RegExp(he.product.addToCart)}),
    ).toHaveCount(0);
  });

  await test.step('fill all three slots from the gallery', async () => {
    await page.getByRole('button', {name: t.surprise.button}).click();
    await expect(
      page.getByRole('button', {name: t.surprise.swap}),
    ).toBeVisible();
    await expect(buy.getByRole('button', {name: t.needApprove})).toBeVisible();
  });

  await test.step('approve the photos', async () => {
    await page.getByRole('button', {name: t.approve}).click();
    await expect(page.getByText(t.ready)).toBeVisible();
    // Gallery photos are already on the CDN, so approving must not upload.
    expect(uploadCalls.count).toBe(0);
  });

  await test.step('add to cart opens the drawer with one line', async () => {
    const atc = buy.getByRole('button', {
      name: new RegExp(he.product.addToCart),
    });
    await expect(atc).toBeEnabled();
    await expect(atc).toContainText(PRODUCT_PRICE);
    await atc.click();

    const drawer = page.getByRole('dialog', {name: he.aside.cart});
    await expect(drawer).toBeVisible();
    const lines = drawer.getByRole('list', {name: he.cart.lineItems});
    await expect(lines.locator(':scope > li')).toHaveCount(1);
    const line = lines.locator(':scope > li').first();
    await expect(line).toContainText(`${COLOR_OPTION}: ${COLOR_LABEL}`);
    await expect(line).toContainText(PRODUCT_PRICE);
    await expect(
      line.getByRole('img', {name: fill(t.slotLabel, {n: 1})}),
    ).toBeVisible();
  });

  await test.step('checkout requires the terms, then leaves for Shopify', async () => {
    const drawer = page.getByRole('dialog', {name: he.aside.cart});
    const blocked = drawer.getByRole('button', {
      name: new RegExp(he.cart.checkout),
    });
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');

    await drawer.getByRole('checkbox').check();
    const checkout = drawer.getByRole('link', {
      name: new RegExp(he.cart.checkout),
    });
    await expect(checkout).toHaveAttribute('href', CHECKOUT_URL_RE);

    // Never let the real checkout load: capture the navigation and abort it.
    await page.route(CHECKOUT_URL_RE, (route) => route.abort());
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.isNavigationRequest() && CHECKOUT_URL_RE.test(r.url()),
      ),
      checkout.click(),
    ]);
    const url = new URL(request.url());
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toMatch(CHECKOUT_URL_RE);
  });
});
