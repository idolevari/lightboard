import {Link} from 'react-router';
import type {ReactNode} from 'react';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams} from '~/lib/search';
import type {RegularSearchReturn} from '~/lib/search';
import {useI18n} from '~/lib/useI18n';

type SearchItems = RegularSearchReturn['result']['items'];

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) return null;
  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

type ArticleNode = SearchItems['articles']['nodes'][number];
type PageNode = SearchItems['pages']['nodes'][number];

function SearchResultsArticles({
  term,
  articles,
}: {
  term: string;
  articles: SearchItems['articles'];
}) {
  const {dict, to} = useI18n();
  if (!articles?.nodes.length) return null;

  return (
    <div className="search-result">
      <h2>{dict.search.articles}</h2>
      <div>
        {articles?.nodes?.map((article: ArticleNode) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: to(`/blogs/${article.handle}`),
            trackingParams: article.trackingParameters,
            term,
          });
          return (
            <div className="search-results-item" key={article.id}>
              <Link prefetch="intent" to={articleUrl}>
                {article.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsPages({
  term,
  pages,
}: {
  term: string;
  pages: SearchItems['pages'];
}) {
  const {dict, to} = useI18n();
  if (!pages?.nodes.length) return null;

  return (
    <div className="search-result">
      <h2>{dict.search.pages}</h2>
      <div>
        {pages?.nodes?.map((page: PageNode) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: to(`/pages/${page.handle}`),
            trackingParams: page.trackingParameters,
            term,
          });
          return (
            <div className="search-results-item" key={page.id}>
              <Link prefetch="intent" to={pageUrl}>
                {page.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsProducts({
  term,
  products,
}: {
  term: string;
  products: SearchItems['products'];
}) {
  const {dict, to} = useI18n();
  if (!products?.nodes.length) return null;

  return (
    <div className="search-result">
      <h2>{dict.search.products}</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: to(`/products/${product.handle}`),
              trackingParams: product.trackingParameters,
              term,
            });

            const price = product?.selectedOrFirstAvailableVariant?.price;
            const image = product?.selectedOrFirstAvailableVariant?.image;

            return (
              <div className="search-results-item" key={product.id}>
                <Link prefetch="intent" to={productUrl}>
                  {image && (
                    <Image data={image} alt={product.title} width={50} />
                  )}
                  <div>
                    <p>{product.title}</p>
                    <small>{price && <Money data={price} />}</small>
                  </div>
                </Link>
              </div>
            );
          });

          return (
            <div>
              <div>
                <PreviousLink>
                  {isLoading ? dict.pagination.loading : <span>↑ {dict.pagination.loadPrevious}</span>}
                </PreviousLink>
              </div>
              <div>
                {ItemsMarkup}
                <br />
              </div>
              <div>
                <NextLink>
                  {isLoading ? dict.pagination.loading : <span>{dict.pagination.loadMore} ↓</span>}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
      <br />
    </div>
  );
}

function SearchResultsEmpty() {
  const {dict} = useI18n();
  return <p>{dict.search.noResults}</p>;
}
