import type {ComponentProps} from 'react';
import {useI18n} from '~/lib/useI18n';
import {AutoLang} from '~/components/AutoLang';
import {ProductPrice} from '~/components/ProductPrice';
import {Doodle} from '~/components/illustrations';
import type {DoodleName} from '~/components/illustrations';

type PriceProps = ComponentProps<typeof ProductPrice>;

/** Product name (or marketing headline), price and the top three USPs. */
export function ProductHead({
  headlineHtml,
  title,
  isPrint,
  price,
  compareAtPrice,
}: {
  /** Sanitized `marketing.headline_*` HTML, when the merchant set one. */
  headlineHtml?: string | null;
  title: string;
  isPrint: boolean;
  price: PriceProps['price'];
  compareAtPrice: PriceProps['compareAtPrice'];
}) {
  const {dict} = useI18n();
  const usps = (
    (dict.usp?.items ?? []) as Array<{icon: string; label: string}>
  ).slice(0, 3);
  return (
    <header className="product-head">
      {headlineHtml ? (
        <h1
          className="pdp-title"
          dangerouslySetInnerHTML={{__html: headlineHtml}}
        />
      ) : (
        <h1 className="pdp-title">
          {/* No marketing headline yet: use the i18n product name.
              Product names stay in English in both locales (owner pref);
              AutoLang marks Latin text lang="en" for screen readers. */}
          {isPrint && dict.printboard?.title ? (
            <AutoLang text={dict.printboard.title} />
          ) : (
            <AutoLang text={title} />
          )}
        </h1>
      )}
      <div className="pdp-price">
        <ProductPrice price={price} compareAtPrice={compareAtPrice} display />
      </div>
      {usps.length > 0 ? (
        <ul className="pdp-usps" role="list">
          {usps.map((u) => (
            <li key={u.label}>
              <Doodle name={u.icon as DoodleName} size={20} />
              <span>{u.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
