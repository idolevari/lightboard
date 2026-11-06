import {
  PRODUCT_PRICE,
  expect,
  fill,
  he,
  test,
  waitForHydration,
} from './support';

const f = he.featured;

test('homepage shows the Lightboard and Printboard blocks with photo carousels', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await waitForHydration(page);

  const lightboard = page.locator('section#featured');
  const printboard = page.locator('section#featured-printboard');

  await test.step('Lightboard carousel: several photos, bars switch slides', async () => {
    const carousel = lightboard.getByRole('region', {
      name: fill(f.photosLabel, {name: he.product.names.lightboard}),
    });
    await carousel.scrollIntoViewIfNeeded();
    const slides = carousel.locator('[aria-roledescription="slide"]');
    const total = await slides.count();
    expect(total).toBeGreaterThan(1);
    await expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');

    const bar = (n: number) =>
      carousel.getByRole('button', {name: fill(f.goToSlide, {n, total})});
    await expect(bar(1)).toHaveAttribute('aria-current', 'true');

    await bar(2).click();
    await expect(bar(2)).toHaveAttribute('aria-current', 'true');
    await expect(bar(1)).not.toHaveAttribute('aria-current', 'true');
    // The second slide is the one actually in view.
    await expect(slides.nth(1)).toBeInViewport({ratio: 0.6});
    await expect(slides.nth(1)).not.toHaveAttribute('aria-hidden', 'true');
    await expect(slides.nth(0)).toHaveAttribute('aria-hidden', 'true');
  });

  await test.step('Printboard block links to its product page', async () => {
    await printboard.scrollIntoViewIfNeeded();
    await expect(
      printboard.getByRole('heading', {
        level: 2,
        name: he.product.names.printboard,
      }),
    ).toBeVisible();
    await expect(
      printboard.locator('[aria-roledescription="slide"]'),
    ).not.toHaveCount(0);
    await expect(printboard).toContainText(PRODUCT_PRICE);
    const cta = printboard.getByRole('link', {name: f.printboard.cta});
    await expect(cta).toHaveAttribute('href', '/products/printboard');
  });
});
