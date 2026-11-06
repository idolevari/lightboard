import {useState} from 'react';
import {Link} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {
  getOptionValueHex,
  translateOptionValue,
} from '~/lib/productOptionLabels';
import {PRINTBOARD_SIZE_LABEL} from '~/lib/customizer-config';
import type {HomeProductCard} from '~/lib/home/types';
import {ProductCarousel} from '~/components/ProductCarousel';
import {Doodle, LiveLoop} from '~/components/illustrations';
import {Reveal} from './Reveal';

/** `marketing.<base>_he` / `<base>_en` metafield pairs on the product card. */
type MarketingField = 'eyebrow' | 'headline' | 'description' | 'shipNote';

/**
 * Pick the locale-appropriate marketing metafield off the product card.
 * Falls back to the Hebrew value when the English one is empty so the
 * storefront never renders a blank.
 */
function localizedMetafield(
  product: HomeProductCard | null,
  base: MarketingField,
  locale: string,
): string {
  const he = product?.[`${base}_he`]?.value;
  const en = product?.[`${base}_en`]?.value;
  return locale === 'en' ? en || he || '' : he || '';
}

type ProductSpecRendered = {
  id: string;
  k: string;
  v: string;
  position: number;
};

function extractProductSpecs(
  product: HomeProductCard | null,
  locale: string,
): Array<ProductSpecRendered> {
  const refs = product?.specs?.references?.nodes ?? [];
  return refs
    .map((spec) => ({
      id: spec.id,
      k:
        locale === 'en'
          ? spec.label_en?.value || spec.label_he?.value || ''
          : spec.label_he?.value || '',
      v:
        locale === 'en'
          ? spec.value_en?.value || spec.value_he?.value || ''
          : spec.value_he?.value || '',
      position: parseInt(spec.position?.value ?? '0', 10) || 0,
    }))
    .sort((a, b) => a.position - b.position);
}

type FeaturedCopy = {
  eyebrow?: string;
  title?: string;
  description?: string;
  specs?: Array<ProductSpecRendered>;
};

/**
 * One homepage product block (photo carousel + copy + price + CTA). Copy
 * comes from the product's `marketing.*` metafields; `fallback` fills any
 * field the merchant hasn't set yet (e.g. the Printboard).
 */
export function FeaturedProduct({
  product,
  sectionId,
  ctaLabel,
  fallback,
  mirrored = false,
}: {
  product: HomeProductCard | null;
  sectionId: string;
  ctaLabel: string;
  fallback?: FeaturedCopy;
  mirrored?: boolean;
}) {
  const {dict, locale} = useI18n();
  const f = dict.featured;
  // Drive the swatch picker from the live Shopify variant data so the merchant
  // can add/rename/recolor variants in admin without a code deploy.
  const colorOption =
    product?.options?.find((o: {name: string}) => o.name === 'Color') ?? null;
  const colorValues: Array<{
    id: string;
    name: string;
    swatch?: {color?: string | null} | null;
  }> = colorOption?.optionValues ?? [];
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colorValues[0]?.name ?? null,
  );
  // Marketing copy comes from product metafields (namespace "marketing")
  // — the merchant edits these in Shopify Admin → Products.
  const eyebrow =
    localizedMetafield(product, 'eyebrow', locale) || fallback?.eyebrow || '';
  const headlineHtml = localizedMetafield(product, 'headline', locale);
  const description =
    localizedMetafield(product, 'description', locale) ||
    fallback?.description ||
    '';
  const shipNote = localizedMetafield(product, 'shipNote', locale);
  const metaSpecs = extractProductSpecs(product, locale);
  const specs = metaSpecs.length > 0 ? metaSpecs : (fallback?.specs ?? []);
  const names = dict.product.names as Record<string, string> | undefined;
  const name =
    (product && names?.[product.handle]) ||
    product?.title ||
    fallback?.title ||
    'Lightboard';
  const titleId = `${sectionId}-title`;
  return (
    <section
      className={`feat3${mirrored ? ' feat3--mirror' : ''}`}
      id={sectionId}
      aria-labelledby={titleId}
    >
      <div className="feat3-grid">
        <LiveLoop className="feat3-media">
          <div className="feat3-stage">
            {product && product.carousel.length > 0 ? (
              <ProductCarousel
                images={product.carousel}
                fallbackAlt={name}
                sizes="(min-width: 980px) 55vw, 100vw"
                labels={{
                  carousel: f.photosLabel.replace('{name}', name),
                  slide: f.slideLabel,
                  goTo: f.goToSlide,
                  prev: f.prevSlide,
                  next: f.nextSlide,
                }}
              />
            ) : (
              <img
                src="/lightboard-lifestyle.jpg"
                alt={name}
                className="feat3-photo"
                loading="lazy"
              />
            )}
          </div>
        </LiveLoop>

        <div className="feat3-rail">
          <Reveal>
            {eyebrow && <div className="feat3-eye">{eyebrow}</div>}
            {headlineHtml ? (
              <h2
                id={titleId}
                className="feat3-title"
                dangerouslySetInnerHTML={{
                  __html: headlineHtml,
                }}
              />
            ) : (
              <h2 id={titleId} className="feat3-title">
                {name}
              </h2>
            )}
            {description && <p className="feat3-desc">{description}</p>}
          </Reveal>

          {specs.length > 0 && (
            <div className="feat3-ticker">
              {specs.map((s) => (
                <div className="feat3-tick" key={s.id}>
                  <span className="k">{s.k}</span>
                  <span className="v">{s.v}</span>
                </div>
              ))}
            </div>
          )}

          {colorValues.length > 1 && (
            <div>
              <div className="feat3-picker-head">
                <span>{f.finishLabel}</span>
                <span className="current">
                  {translateOptionValue(dict, selectedColor ?? '')}
                </span>
              </div>
              <div className="feat3-swatches">
                {colorValues.map((v) => {
                  const hex = v.swatch?.color ?? getOptionValueHex(v.name);
                  const isOn = selectedColor === v.name;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedColor(v.name)}
                      className={`feat3-swatch ${isOn ? 'on' : ''}`}
                      aria-pressed={isOn}
                      type="button"
                    >
                      <span
                        className="dot"
                        style={{background: hex ?? '#999'}}
                        aria-hidden="true"
                      />
                      <span>{translateOptionValue(dict, v.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product ? (
            <BuyBar
              price={product.priceRange?.minVariantPrice?.amount}
              currencyCode={product.priceRange?.minVariantPrice?.currencyCode}
              note={shipNote}
              ctaPrimary={ctaLabel}
              handle={product.handle}
              variantColor={colorValues.length > 1 ? selectedColor : null}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Printboard block: no marketing metafields yet, so copy comes from i18n. */
export function FeaturedPrintboard({
  product,
}: {
  product: HomeProductCard | null;
}) {
  const {dict} = useI18n();
  if (!product) return null;
  const copy = dict.featured.printboard;
  const specs = (
    (dict.printboard?.specs ?? []) as Array<{label: string; value: string}>
  ).map((spec, i) => ({
    id: `pb-spec-${i}`,
    k: spec.label,
    v: spec.value.replace('{size}', PRINTBOARD_SIZE_LABEL),
    position: i,
  }));
  return (
    <FeaturedProduct
      product={product}
      sectionId="featured-printboard"
      ctaLabel={copy.cta}
      mirrored
      fallback={{
        eyebrow: copy.eyebrow,
        description: copy.description,
        specs,
      }}
    />
  );
}

type BuyBarProps = {
  price?: string | null;
  currencyCode?: string | null;
  note?: string;
  ctaPrimary: string;
  handle: string;
  variantColor: string | null;
};

function BuyBar({
  price,
  currencyCode,
  note,
  ctaPrimary,
  handle,
  variantColor,
}: BuyBarProps) {
  const {to} = useI18n();
  const base = to(`/products/${handle}`);
  const href = variantColor
    ? `${base}?Color=${encodeURIComponent(variantColor)}`
    : base;
  const amount = price != null ? Math.round(parseFloat(price)) : null;
  return (
    <div className="feat3-buy">
      {amount != null && (
        <div className="feat3-price">
          <span className="cur">{currencySymbol(currencyCode)}</span>
          <span className="num">{amount}</span>
          {note && (
            <span className="note">
              <Doodle name="van" size={18} />
              {note}
            </span>
          )}
        </div>
      )}
      <div className="feat3-actions">
        <Link to={href} prefetch="intent" className="feat3-cta">
          <span>{ctaPrimary}</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

function currencySymbol(code: string | null | undefined): string {
  switch (code) {
    case 'ILS':
      return '₪';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    default:
      return code ?? '';
  }
}
