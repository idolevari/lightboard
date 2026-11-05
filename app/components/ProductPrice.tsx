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

/**
 * Display-size price: same Intl formatting as `formatMoney`, but the
 * currency symbol gets its own span so it can be set small and warm
 * (`--sunset-ink`). Read as one string by screen readers.
 */
export function DisplayPrice({data}: {data: MoneyLike | null | undefined}) {
  const {locale} = useI18n();
  const text = formatMoney(data, locale);
  if (!text || !data?.amount) return null;
  let parts: Array<Intl.NumberFormatPart> = [];
  try {
    const value = Number(data.amount);
    const whole = Number.isInteger(value);
    parts = new Intl.NumberFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
      style: 'currency',
      currency: data.currencyCode || 'ILS',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).formatToParts(value);
  } catch {
    return <bdi className="price-display">{text}</bdi>;
  }
  return (
    <bdi className="price-display">
      <span className="sr-only">{text}</span>
      {parts
        .filter((p) => !/^[\u200e\u200f]+$/.test(p.value))
        .map((p, i) =>
          p.type === 'currency' ? (
            // eslint-disable-next-line react/no-array-index-key -- static parts list
            <span key={i} className="cur" aria-hidden="true">
              {p.value}
            </span>
          ) : p.type === 'literal' ? null : (
            // eslint-disable-next-line react/no-array-index-key -- static parts list
            <span key={i} className="num" aria-hidden="true">
              {p.value}
            </span>
          ),
        )}
    </bdi>
  );
}

type ProductPriceProps = {
  price?: MoneyV2 | null;
  compareAtPrice?: MoneyV2 | null;
  /** Large editorial price with a separate currency glyph (PDP). */
  display?: boolean;
};

export function ProductPrice({price, compareAtPrice, display}: ProductPriceProps) {
  const {dict} = useI18n();
  return (
    <div
      aria-label={dict.product.priceLabel}
      className={`product-price${display ? ' product-price--display' : ''}`}
      role="group"
    >
      {compareAtPrice ? (
        <div className="product-price-on-sale">
          {price ? (
            display ? <DisplayPrice data={price} /> : <Price data={price} />
          ) : null}
          <s>
            <Price data={compareAtPrice} />
          </s>
        </div>
      ) : price ? (
        display ? (
          <DisplayPrice data={price} />
        ) : (
          <Price data={price} />
        )
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
