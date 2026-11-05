import {AxeBuilder} from '@axe-core/playwright';
import type {Page} from '@playwright/test';
import {
  PRODUCT_PATH,
  addBoardToCart,
  expect,
  test,
  waitForHydration,
} from './support';

/**
 * axe-core scan (WCAG 2.x A/AA). Fails on serious or critical violations;
 * minor/moderate ones are attached to the report for triage.
 */
async function expectNoSeriousViolations(page: Page, name: string) {
  const results = await new AxeBuilder({page})
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // Third-party iframes (privacy banner, pixels) aren't ours to fix.
    .exclude('iframe')
    .analyze();
  await test.info().attach(`axe-${name}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });
  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));
  expect(blocking, `serious/critical axe violations on ${name}`).toEqual([]);
}

test('home page has no serious accessibility violations', async ({page}) => {
  await page.goto('/');
  await waitForHydration(page);
  await expectNoSeriousViolations(page, 'home');
});

test('product page has no serious accessibility violations', async ({page}) => {
  await page.goto(PRODUCT_PATH);
  await waitForHydration(page);
  await expectNoSeriousViolations(page, 'product');
});

test('cart has no serious accessibility violations', async ({page}) => {
  await addBoardToCart(page);
  await page.goto('/cart');
  await waitForHydration(page);
  await expect(page.getByRole('checkbox')).toBeVisible();
  await expectNoSeriousViolations(page, 'cart');
});
