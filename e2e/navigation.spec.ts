import {en, expect, he, test, waitForHydration} from './support';

test.describe('mobile menu', () => {
  test.skip(
    ({isMobile}) => !isMobile,
    'The burger menu is the phone navigation',
  );

  test('opens with search, account and language links', async ({page}) => {
    await page.goto('/');
    await waitForHydration(page);

    const burger = page.getByRole('button', {name: he.nav.menu, exact: true});
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
    await burger.click();
    await expect(burger).toHaveAttribute('aria-expanded', 'true');

    const menu = page.getByRole('dialog', {name: he.aside.menu});
    await expect(menu).toBeVisible();
    const primary = menu.getByRole('navigation', {name: he.nav.primaryLabel});
    for (const label of [
      he.nav.shop,
      he.nav.about,
      he.nav.faq,
      he.nav.contact,
    ]) {
      await expect(primary.getByRole('link', {name: label})).toBeVisible();
    }
    await expect(menu.getByRole('button', {name: he.nav.search})).toBeVisible();
    await expect(
      menu.getByRole('link', {name: he.nav.account}),
    ).toHaveAttribute('href', '/account');
    const lang = menu.getByRole('group', {name: he.nav.language});
    await expect(lang.getByRole('link')).toHaveCount(2);

    // HE → EN from inside the drawer.
    await lang.getByRole('link', {name: /English/i}).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('language toggle switches HE → EN', async ({page, isMobile}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await waitForHydration(page);

  if (isMobile) {
    await page.getByRole('button', {name: he.nav.menu, exact: true}).click();
  }
  const scope = isMobile
    ? page.getByRole('dialog', {name: he.aside.menu})
    : page.locator('header');
  await scope
    .getByRole('group', {name: he.nav.language})
    .getByRole('link', {name: /English/i})
    .click();

  await expect(page).toHaveURL(/\/en\/?$/);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveCount(1);

  // The English UI is live: the menu / primary nav reads in English now.
  const label = isMobile ? en.nav.menu : en.nav.primaryLabel;
  await expect(
    isMobile
      ? page.getByRole('button', {name: label, exact: true})
      : page.getByRole('navigation', {name: label}).first(),
  ).toBeVisible();
});

test('contact page has a heading and working contact links', async ({page}) => {
  await page.goto('/pages/contact');
  await expect(
    page.getByRole('heading', {level: 1, name: he.contact.title}),
  ).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);

  const block = page.getByRole('region', {name: he.contact.title});
  await expect(
    block.getByRole('link', {name: he.whatsapp.label}),
  ).toHaveAttribute('href', /^https:\/\/(wa\.me|api\.whatsapp\.com)\//);
  await expect(
    block.getByRole('link', {name: new RegExp(he.contact.phone)}),
  ).toHaveAttribute('href', /^tel:\+?\d+/);
  await expect(
    block.getByRole('link', {name: new RegExp(he.contact.email)}),
  ).toHaveAttribute('href', /^mailto:.+@.+/);
});

test('unknown URLs render the 404 page', async ({page}) => {
  const response = await page.goto('/this-page-does-not-exist-e2e');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', {level: 1, name: he.notFound.title}),
  ).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('link', {name: he.notFound.cta})).toHaveAttribute(
    'href',
    '/',
  );
});
