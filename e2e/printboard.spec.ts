import {
  CHECKOUT_URL_RE,
  PRODUCT_PRICE,
  expect,
  he,
  test,
  waitForHydration,
} from './support';

const PRINTBOARD_PATH = '/products/printboard';
const pt = he.printboard;
// Labels live with the preset data in app/lib/printboard-presets.ts.
const PRESET_NAME = 'גולש בחוף הדקלים';
const OTHER_PRESET_NAME = 'גל בשקיעה';

/**
 * Printboard happy path up to — and never past — Shopify checkout, using a
 * ready-made design (already on the CDN, so nothing is uploaded; the upload
 * endpoint is mocked anyway by the `uploadCalls` fixture).
 */
test('buy a Printboard with a ready-made design up to the checkout redirect', async ({
  page,
  uploadCalls,
}) => {
  await page.goto(PRINTBOARD_PATH);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(pt.title);
  await waitForHydration(page);

  const preview = page.getByRole('img', {name: pt.previewLabel, exact: true});
  const buy = page.locator('.product-buy');

  await test.step('the bare board asks for a design', async () => {
    await expect(preview).toBeVisible();
    await expect(preview.locator('image')).toHaveCount(0);
    await expect(buy.getByRole('button', {name: pt.needDesign})).toBeVisible();
  });

  await test.step('picking a design puts it on the board preview', async () => {
    const designs = page.getByRole('radiogroup', {name: pt.presetsTitle});
    await expect(designs.getByRole('radio')).toHaveCount(5);
    const preset = designs.getByRole('radio', {name: PRESET_NAME});
    await preset.click();
    await expect(preset).toHaveAttribute('aria-checked', 'true');
    const filled = page.getByRole('img', {
      name: `${pt.previewLabel}: ${PRESET_NAME}`,
    });
    await expect(filled).toBeVisible();
    await expect(filled.locator('image')).toHaveAttribute(
      'href',
      /cdn\.shopify\.com/,
    );
    // One action at a time: approve, the add-to-cart block steps aside.
    await expect(
      page.locator('#customizer').getByRole('button', {name: pt.approve}),
    ).toBeVisible();
    await expect(buy).toBeHidden();
  });

  await test.step('the crop dialog shows the board outline and a live preview', async () => {
    await page.getByRole('button', {name: pt.adjust}).click();
    const dialog = page.getByRole('dialog', {name: pt.cropTitle});
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('img', {name: pt.livePreview}).locator('image'),
    ).toHaveCount(1);
    await dialog
      .getByRole('button', {name: he.photoCustomizer.cropSave})
      .click();
    await expect(dialog).toBeHidden();
  });

  await test.step('approve without uploading', async () => {
    await page
      .locator('#customizer')
      .getByRole('button', {name: pt.approve})
      .click();
    await expect(page.getByText(pt.ready)).toBeVisible();
    expect(uploadCalls.count).toBe(0);
  });

  await test.step('add to cart: the line shows the Printboard and its design', async () => {
    const atc = buy.getByRole('button', {
      name: new RegExp(he.product.addToCart),
    });
    await expect(atc).toContainText(PRODUCT_PRICE);
    await atc.click();
    const drawer = page.getByRole('dialog', {name: he.aside.cart});
    await expect(drawer).toBeVisible();
    const lines = drawer.getByRole('list', {name: he.cart.lineItems});
    await expect(lines.locator(':scope > li')).toHaveCount(1);
    const line = lines.locator(':scope > li').first();
    await expect(line).toContainText(pt.title);
    await expect(line).toContainText(`${pt.cartDesign}: ${PRESET_NAME}`);
    await expect(
      line.getByRole('img', {name: `${pt.title} – ${PRESET_NAME}`}),
    ).toBeVisible();
  });

  await test.step('checkout requires the terms, then leaves for Shopify', async () => {
    const drawer = page.getByRole('dialog', {name: he.aside.cart});
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
    expect(new URL(request.url()).pathname).toMatch(CHECKOUT_URL_RE);
  });
});

/** Regression: changing the design after approval must un-approve. */
test('switching design after approval blocks add to cart again', async ({
  page,
}) => {
  await page.goto(PRINTBOARD_PATH);
  await waitForHydration(page);
  const buy = page.locator('.product-buy');
  const designs = page.getByRole('radiogroup', {name: pt.presetsTitle});

  await designs.getByRole('radio', {name: PRESET_NAME}).click();
  await page
    .locator('#customizer')
    .getByRole('button', {name: pt.approve})
    .click();
  await expect(page.getByText(pt.ready)).toBeVisible();

  await designs.getByRole('radio', {name: OTHER_PRESET_NAME}).click();
  await expect(page.getByText(pt.ready)).toHaveCount(0);
  await expect(
    page.locator('#customizer').getByRole('button', {name: pt.approve}),
  ).toBeVisible();

  await page.getByRole('button', {name: pt.remove, exact: true}).click();
  await expect(buy.getByRole('button', {name: pt.needDesign})).toBeVisible();
  await expect(
    buy.getByRole('button', {name: new RegExp(he.product.addToCart)}),
  ).toHaveCount(0);
});

test('the shop grid lists the Lightboard and the Printboard', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await waitForHydration(page);
  if (isMobile) {
    await page.getByRole('button', {name: he.nav.menu, exact: true}).click();
  }
  const scope = isMobile
    ? page.getByRole('dialog', {name: he.aside.menu})
    : page.locator('header');
  await scope
    .getByRole('navigation', {name: he.nav.primaryLabel})
    .getByRole('link', {name: he.nav.shop})
    .click();

  await expect(page).toHaveURL(/\/collections\/all$/);
  await expect(
    page.getByRole('heading', {level: 1, name: he.collections.shopTitle}),
  ).toBeVisible();
  const lightboard = page.locator('a[href="/products/lightboard"]', {
    has: page.getByRole('heading', {name: he.product.names.lightboard}),
  });
  const printboard = page.locator('a[href="/products/printboard"]', {
    has: page.getByRole('heading', {name: he.product.names.printboard}),
  });
  await expect(lightboard).toBeVisible();
  await expect(printboard).toBeVisible();
  await expect(printboard).toContainText(PRODUCT_PRICE);
});
