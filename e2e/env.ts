/** Shared, dependency-free settings for the config, global setup and specs. */

/** Where global-setup writes the starting storage state (gitignored). */
export const STORAGE_STATE = 'playwright/.auth/state.json';

export const BYPASS_HEADER = 'oxygen-auth-bypass-token';

/**
 * Header that lets requests into a private Oxygen preview. Only ever sent to
 * the storefront origin (never to Shopify CDN, fonts or pixels), so the
 * token doesn't leak to third parties or trigger CORS preflights there.
 */
export function bypassHeaders(): Record<string, string> | undefined {
  const token = process.env.OXYGEN_AUTH_BYPASS_TOKEN;
  return token ? {[BYPASS_HEADER]: token} : undefined;
}
