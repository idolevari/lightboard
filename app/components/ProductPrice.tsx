import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {useI18n} from '~/lib/useI18n';

export type MoneyLike = {amount?: string | null; currencyCode?: string | null};

/**
 * Single price formatter for the whole storefront.
 *
 * Follows the locale's own convention via Intl: Hebrew → "279 ₪" (symbol
 * after the number), English → "₪279". Whole amounts drop the ".00" noise;
 * fractional amounts keep two decimals. Intl's he-IL output carries a
 * leading RLM mark which we strip — callers isolate the result in <bdi>.
 */
export function formatMoney(
  money: MoneyLike | null | undefined,
  locale: string,
): string {
  if (!money?.amount) return '';
  const value = Number(money.amount);
  if (!Number.isFinite(value)) return '';
  const whole = Number.isInteger(value);
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
      style: 'currency',
      currency: money.currencyCode || 'ILS',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
      .format(value)
      .replace(/[‎‏]/g, '');
  } catch {
    return `${money.amount} ${money.currencyCode}`;
  }
}

/** Inline price, bidi-isolated so it never merges with surrounding text. */
export function Price({
  data,
  className,
}: {
  data: MoneyLike | null | undefined;
  className?: string;
}) {
  const {locale} = useI18n();
  const text = formatMoney(data, locale);
  if (!text) return null;
  return <bdi className={className}>{text}</bdi>;
}

type ProductPriceProps = {
  price?: MoneyV2 | null;
  compareAtPrice?: MoneyV2 | null;
};

export function ProductPrice({price, compareAtPrice}: ProductPriceProps) {
  const {dict} = useI18n();
  return (
    <div
      aria-label={dict.product.priceLabel}
      className="product-price"
      role="group"
    >
      {compareAtPrice ? (
        <div className="product-price-on-sale">
          {price ? <Price data={price} /> : null}
          <s>
            <Price data={compareAtPrice} />
          </s>
        </div>
      ) : price ? (
        <Price data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
