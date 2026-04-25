import {useRouteLoaderData} from 'react-router';
import {
  DEFAULT_LOCALE,
  getDictionary,
  getLocaleConfig,
  localizedPath,
} from '~/lib/i18n';

/**
 * Access the active locale, its config, and UI dictionary.
 * Falls back to the default locale when no root loader data exists
 * (e.g. during ErrorBoundary renders).
 */
export function useI18n() {
  const data = useRouteLoaderData('root');
  const locale = data?.locale ?? DEFAULT_LOCALE;
  const config = data?.localeConfig ?? getLocaleConfig(locale);
  const dict = data?.dict ?? getDictionary(locale);
  const pathnameNoLocale = data?.pathnameNoLocale ?? '/';
  return {
    locale,
    config,
    dict,
    pathnameNoLocale,
    to: (path) => localizedPath(path, locale),
  };
}
