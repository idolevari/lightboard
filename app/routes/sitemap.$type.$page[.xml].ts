import {buildAlternates, absoluteUrl} from '~/lib/seo-urls';
import {SUPPORTED_LOCALES} from '~/lib/i18n';
import type {Route} from './+types/sitemap.$type.$page[.xml]';

/**
 * Child sitemaps. Hydrogen's `getSitemap` only lists the default-locale URL
 * and takes the host from the request, so we render our own:
 *  - every resource appears once per locale (`/x` for Hebrew, `/en/x` for
 *    English), each with he / en / x-default alternates;
 *  - URLs always use the production origin (https://lightboard.co.il);
 *  - `static` lists the homepage, the catalogue and the live policies.
 */

type SitemapItem = {handle: string; updatedAt?: string | null};

const RESOURCE_TYPES = {
  products: 'PRODUCT',
  collections: 'COLLECTION',
  pages: 'PAGE',
} as const;

/** Resources that should not be indexed (duplicates or placeholders). */
const EXCLUDED: Partial<Record<keyof typeof RESOURCE_TYPES, Array<string>>> = {
  // Shopify's default homepage collection duplicates "/".
  collections: ['frontpage'],
};

export async function loader({
  params,
  context: {storefront},
}: Route.LoaderArgs) {
  const page = Number.parseInt(params.page ?? '', 10);
  if (!Number.isFinite(page) || page < 1) {
    throw new Response('Not found', {status: 404});
  }

  let entries: Array<{path: string; lastmod?: string | null}>;

  if (params.type === 'static') {
    if (page !== 1) throw new Response('Not found', {status: 404});
    entries = await staticEntries(storefront);
  } else if (params.type === 'articles') {
    // Article URLs need the blog handle, which the sitemap API doesn't give.
    if (page !== 1) throw new Response('Not found', {status: 404});
    const data = await storefront.query(SITEMAP_ARTICLES_QUERY, {
      cache: storefront.CacheLong(),
    });
    entries = (data?.articles?.nodes ?? []).map((a) => ({
      path: `/blogs/${a.blog.handle}/${a.handle}`,
      lastmod: a.publishedAt,
    }));
  } else if (params.type && params.type in RESOURCE_TYPES) {
    const type = params.type as keyof typeof RESOURCE_TYPES;
    const data = await storefront.query(SITEMAP_RESOURCES_QUERY, {
      variables: {type: RESOURCE_TYPES[type], page},
      cache: storefront.CacheLong(),
    });
    const items: Array<SitemapItem> = data?.sitemap?.resources?.items ?? [];
    const excluded = EXCLUDED[type] ?? [];
    entries = items
      .filter((item) => item.handle && !excluded.includes(item.handle))
      .map((item) => ({
        path: `/${type}/${item.handle}`,
        lastmod: item.updatedAt,
      }));
  } else {
    throw new Response('Not found', {status: 404});
  }

  // A <urlset> needs at least one <url> (e.g. when the only collection is
  // the excluded "frontpage"); fall back to the catalogue page.
  if (entries.length === 0) entries = [{path: '/collections/all'}];

  return new Response(renderUrlset(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

async function staticEntries(
  storefront: Route.LoaderArgs['context']['storefront'],
): Promise<Array<{path: string}>> {
  const data = (await storefront
    .query(SITEMAP_POLICIES_QUERY, {cache: storefront.CacheLong()})
    .catch(() => null)) as {
    shop?: Record<string, {handle?: string | null} | null>;
  } | null;
  const policies = Object.values(data?.shop ?? {})
    .map((p) => p?.handle)
    .filter((h): h is string => Boolean(h))
    .map((handle) => ({path: `/policies/${handle}`}));
  return [{path: '/'}, {path: '/collections/all'}, ...policies];
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrlset(
  entries: Array<{path: string; lastmod?: string | null}>,
): string {
  const urls = entries.flatMap(({path, lastmod}) => {
    const alternates = buildAlternates(path)
      .map(
        (alt) =>
          `    <xhtml:link rel="alternate" hreflang="${alt.hrefLang}" href="${xmlEscape(alt.href)}" />`,
      )
      .join('\n');
    return SUPPORTED_LOCALES.map(
      (locale) => `  <url>
    <loc>${xmlEscape(absoluteUrl(path, locale))}</loc>${
      lastmod ? `\n    <lastmod>${xmlEscape(lastmod)}</lastmod>` : ''
    }
${alternates}
  </url>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;
}

const SITEMAP_RESOURCES_QUERY = `#graphql
  query SitemapResources($type: SitemapType!, $page: Int!) {
    sitemap(type: $type) {
      resources(page: $page) {
        items {
          handle
          updatedAt
        }
      }
    }
  }
` as const;

const SITEMAP_ARTICLES_QUERY = `#graphql
  query SitemapArticles {
    articles(first: 250, sortKey: PUBLISHED_AT, reverse: true) {
      nodes {
        handle
        publishedAt
        blog { handle }
      }
    }
  }
` as const;

const SITEMAP_POLICIES_QUERY = `#graphql
  query SitemapPolicies {
    shop {
      privacyPolicy { handle }
      refundPolicy { handle }
      shippingPolicy { handle }
      termsOfService { handle }
    }
  }
` as const;
