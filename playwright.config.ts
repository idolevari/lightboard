import {defineConfig, devices} from '@playwright/test';

/**
 * End-to-end tests against a running storefront.
 *
 *   E2E_BASE_URL               Storefront origin (default http://localhost:3000).
 *                              CI sets it to the Oxygen preview deployment URL.
 *   OXYGEN_AUTH_BYPASS_TOKEN   Token from `shopify hydrogen deploy
 *                              --auth-bypass-token`. Sent as the
 *                              `oxygen-auth-bypass-token` header so private
 *                              Oxygen previews let the browser in.
 *   E2E_PREVIEW_TOKEN          Optional PREVIEW_TOKEN of the target deployment.
 *                              Only needed when the launch gate (COMING_SOON)
 *                              is on there; global-setup trades it for the
 *                              lb_preview bypass cookie.
 *
 * The store is live: the suite never pays, never fills checkout, never
 * uploads to Shopify Files and never creates customer accounts.
 */
const baseURL = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const bypassToken = process.env.OXYGEN_AUTH_BYPASS_TOKEN;
const isCI = Boolean(process.env.CI);

export const STORAGE_STATE = 'test-results/.auth/state.json';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Every test hits the live Storefront API; keep the load polite.
  workers: isCI ? 2 : 3,
  timeout: 60_000,
  expect: {timeout: 10_000},
  reporter: isCI
    ? [['github'], ['html', {open: 'never', outputFolder: 'playwright-report'}]]
    : [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}]],
  use: {
    baseURL,
    storageState: STORAGE_STATE,
    extraHTTPHeaders: bypassToken
      ? {'oxygen-auth-bypass-token': bypassToken}
      : undefined,
    // The site honours reduced motion; it also stops idle "nudge" animations
    // that would otherwise keep buttons from ever being "stable" for clicks.
    contextOptions: {reducedMotion: 'reduce'},
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 390, height: 844},
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: 'he-IL',
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {width: 1440, height: 900},
        locale: 'he-IL',
      },
    },
  ],
});
