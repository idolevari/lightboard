import {useLocation} from 'react-router';
import {useMemo} from 'react';

/**
 * @param {string} handle
 * @param {SelectedOption[]} [selectedOptions]
 */
export function useVariantUrl(handle, selectedOptions) {
  const {pathname} = useLocation();

  return useMemo(() => {
    return getVariantUrl({
      handle,
      pathname,
      searchParams: new URLSearchParams(),
      selectedOptions,
    });
  }, [handle, selectedOptions, pathname]);
}

/**
 * @param {{
 *   handle: string;
 *   pathname: string;
 *   searchParams: URLSearchParams;
 *   selectedOptions?: SelectedOption[];
 * }}
 */
export function getVariantUrl({
  handle,
  pathname,
  searchParams,
  selectedOptions,
}) {
  // Preserve a Shopify market-style locale (e.g. /en-us/) if present, OR the
  // app's own locale prefix (e.g. /en/) so deep links don't lose locale.
  const marketMatch = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/g.exec(pathname);
  const localeMatch =
    !marketMatch && /^\/(en|he)(?=\/|$)/.exec(pathname || '');

  const prefix = marketMatch
    ? marketMatch[0]
    : localeMatch
      ? `/${localeMatch[1]}/`
      : '/';

  const path = `${prefix}products/${handle}`.replace(/\/+/g, '/');

  selectedOptions?.forEach((option) => {
    searchParams.set(option.name, option.value);
  });

  const searchString = searchParams.toString();

  return path + (searchString ? '?' + searchString : '');
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').SelectedOption} SelectedOption */
