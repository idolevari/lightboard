import {useRouteLoaderData} from 'react-router';
import type {Dictionary, Locale, LocaleConfig} from '~/lib/i18n';
import {
  DEFAULT_LOCALE,
  getDictionary,
  getLocaleConfig,
  localizedPath,
} from '~/lib/i18n';

export type UseI18nReturn = {
  locale: Locale;
  config: LocaleConfig;
  dict: Dictionary;
  pathnameNoLocale: string;
  to: (path: string) => string;
};

type RootI18nData = {
  locale?: Locale;
  localeConfig?: LocaleConfig;
  dict?: Dictionary;
  pathnameNoLocale?: string;
};

/**
 * Access the active locale, its config, and UI dictionary.
 * Falls back to the default locale when no root loader data exists
 * (e.g. during ErrorBoundary renders).
 */
export function useI18n(): UseI18nReturn {
  const data = useRouteLoaderData('root') as RootI18nData | undefined;
  const locale: Locale = data?.locale ?? DEFAULT_LOCALE;
  const config = data?.localeConfig ?? getLocaleConfig(locale);
  const dict = data?.dict ?? getDictionary(locale);
  const pathnameNoLocale = data?.pathnameNoLocale ?? '/';
  return {
    locale,
    config,
    dict,
    pathnameNoLocale,
    to: (path: string) => localizedPath(path, locale),
  };
}
