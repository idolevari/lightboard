import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {request} from '@playwright/test';
import type {FullConfig} from '@playwright/test';
import {STORAGE_STATE, bypassHeaders} from './env';

/**
 * Prepares the shared storage state every test starts from.
 *
 * When E2E_PREVIEW_TOKEN is set (the target has COMING_SOON=true), trade it
 * for the lb_preview bypass cookie via /preview so the suite sees the real
 * storefront instead of the Coming Soon page. Otherwise write an empty state.
 */
export default async function globalSetup(config: FullConfig) {
  await mkdir(dirname(STORAGE_STATE), {recursive: true});

  const previewToken = process.env.E2E_PREVIEW_TOKEN;
  const {baseURL} = config.projects[0].use;
  if (!previewToken || !baseURL) {
    await writeFile(STORAGE_STATE, JSON.stringify({cookies: [], origins: []}));
    return;
  }

  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: bypassHeaders(),
  });
  const res = await ctx.get(
    `/preview?token=${encodeURIComponent(previewToken)}`,
    {maxRedirects: 0},
  );
  if (res.status() !== 302 && res.status() !== 303) {
    throw new Error(
      `E2E_PREVIEW_TOKEN was rejected by ${baseURL}/preview (HTTP ${res.status()})`,
    );
  }
  await ctx.storageState({path: STORAGE_STATE});
  await ctx.dispose();
}
