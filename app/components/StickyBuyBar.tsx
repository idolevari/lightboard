import {useEffect, useState} from 'react';
import type {RefObject} from 'react';
import type {MoneyLike} from './ProductPrice';
import {Price} from './ProductPrice';
import {useI18n} from '~/lib/useI18n';

type StickyBuyBarProps = {
  /** Wrapper around the real add-to-cart panel (`.product-buy`). */
  buyRef: RefObject<HTMLDivElement>;
  price?: MoneyLike | null;
  colorHex?: string | null;
  colorName?: string;
  /** Photos approved (or not required) → the real CTA adds to cart. */
  ready: boolean;
  available: boolean;
};

/**
 * Mobile-only sticky buy bar (≤768px) shown while the main add-to-cart
 * panel is off-screen.
 *
 * It owns NO cart logic: its button forwards the tap to the real CTA inside
 * `buyRef` (the same `ProductCartAction` button), so the photo-approval
 * gating, the "go to customizer" behaviour, CartForm submission, analytics
 * and the drawer opening all stay in one place.
 *
 * position:fixed → no layout shift. The FABs move up while it is visible
 * (`body.has-buybar`), and it pads for the iOS home indicator.
 */
export function StickyBuyBar({
  buyRef,
  price,
  colorHex,
  colorName,
  ready,
  available,
}: StickyBuyBarProps) {
  const {dict} = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = buyRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 768px)');
    let intersecting = true;
    const sync = () => setVisible(mq.matches && !intersecting);
    const obs = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        sync();
      },
      // Treat the strip under the bar as "not visible" so the two never
      // show at the same time.
      {rootMargin: '0px 0px -72px 0px'},
    );
    obs.observe(target);
    mq.addEventListener('change', sync);
    return () => {
      obs.disconnect();
      mq.removeEventListener('change', sync);
    };
  }, [buyRef]);

  useEffect(() => {
    document.body.classList.toggle('has-buybar', visible);
    return () => document.body.classList.remove('has-buybar');
  }, [visible]);

  function forward() {
    const real = buyRef.current?.querySelector<HTMLButtonElement>(
      'button.atc-btn',
    );
    if (!real || real.disabled) return;
    real.click();
  }

  const label = !available
    ? dict.product.soldOut
    : ready
      ? dict.product.addToCart
      : dict.product.choosePhotos;

  return (
    <div
      className={`sticky-buy${visible ? ' is-visible' : ''}`}
      role="region"
      aria-label={dict.product.stickyLabel}
      aria-hidden={!visible}
      // React 18 has no `inert` prop; the lowercase attribute passes through.
      {...(visible ? {} : ({inert: ''} as Record<string, string>))}
    >
      <div className="sticky-buy__info">
        {colorHex ? (
          <span
            className="sticky-buy__dot"
            style={{background: colorHex}}
            aria-hidden="true"
          />
        ) : null}
        <span className="sticky-buy__text">
          {colorName ? <span className="sticky-buy__color">{colorName}</span> : null}
          <Price data={price} className="sticky-buy__price" />
        </span>
      </div>
      <button
        type="button"
        className={`sticky-buy__btn${ready ? '' : ' is-pending'}`}
        onClick={forward}
        disabled={!available}
        tabIndex={visible ? 0 : -1}
      >
        {label}
      </button>
    </div>
  );
}

