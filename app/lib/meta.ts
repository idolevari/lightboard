/**
 * Helpers for route `meta()` functions.
 *
 * `matches` is the React Router matches array; the root match owns the
 * Storefront `shop` data (name + primaryDomain) fetched in HEADER_QUERY, so
 * any nested route can read it from there.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-router's MetaArgs `matches` shape is awkward to thread through; we narrow via optional chaining at use sites
type MetaMatch = {id: string; data?: any};

function rootData(matches: ReadonlyArray<MetaMatch> | undefined) {
  return matches?.find?.((m) => m.id === 'root')?.data;
}

export function siteName(
  matches: ReadonlyArray<MetaMatch> | undefined,
): string {
  return rootData(matches)?.header?.shop?.name ?? 'Lightboard';
}

export function siteOrigin(
  matches: ReadonlyArray<MetaMatch> | undefined,
): string {
  const url = rootData(matches)?.header?.shop?.primaryDomain?.url;
  if (!url) return '';
  // primaryDomain.url is the full origin (e.g. https://lightboard.co.il).
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Build a "<Site> | <Page>" title with a single source of truth for the
 * site name. Returns just the site name when no page title is provided.
 */
export function pageTitle(
  matches: ReadonlyArray<MetaMatch> | undefined,
  pageTitle?: string | null,
): string {
  const site = siteName(matches);
  if (!pageTitle) return site;
  return `${site} | ${pageTitle}`;
}

/**
 * Absolute canonical URL for the current page. Returns a relative path when
 * the shop's primary domain is unavailable (e.g., during ErrorBoundary).
 */
export function canonicalUrl(
  matches: ReadonlyArray<MetaMatch> | undefined,
  pathname: string,
): string {
  const origin = siteOrigin(matches);
  return origin ? `${origin}${pathname}` : pathname;
}
