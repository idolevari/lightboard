import {SITE_URL} from '~/lib/seo-urls';
import type {Route} from './+types/[sitemap.xml]';

/**
 * Sitemap index. Lists the static sitemap (home, catalogue, policies) and
 * one child per page of products, collections and pages. Articles are
 * listed only once the blog has posts; empty blogs are left out.
 * Always uses the production origin.
 */
export async function loader({context: {storefront}}: Route.LoaderArgs) {
  const data = await storefront.query(SITEMAP_INDEX_COUNTS_QUERY, {
    cache: storefront.CacheLong(),
  });

  const counts: Record<string, number> = {
    products: data?.products?.pagesCount?.count ?? 0,
    collections: data?.collections?.pagesCount?.count ?? 0,
    pages: data?.pages?.pagesCount?.count ?? 0,
  };
  // Empty blogs are thin pages: list articles only once posts exist.
  if (data?.articles?.nodes?.length) counts.articles = 1; // one page, see child route

  const children = [`${SITE_URL}/sitemap/static/1.xml`];
  for (const [type, count] of Object.entries(counts)) {
    for (let page = 1; page <= count; page++) {
      children.push(`${SITE_URL}/sitemap/${type}/${page}.xml`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join('\n')}
</sitemapindex>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

const SITEMAP_INDEX_COUNTS_QUERY = `#graphql
  query SitemapIndexCounts {
    products: sitemap(type: PRODUCT) { pagesCount { count } }
    collections: sitemap(type: COLLECTION) { pagesCount { count } }
    pages: sitemap(type: PAGE) { pagesCount { count } }
    articles(first: 1) { nodes { id } }
  }
` as const;
