import {CartForm} from '@shopify/hydrogen';
import {Price} from '~/components/ProductPrice';
import type {MoneyLike} from '~/components/ProductPrice';
import type {OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useId, useRef, useState} from 'react';
import type {ReactNode, Ref} from 'react';
import {useFetcher} from 'react-router';
import {useI18n} from '~/lib/useI18n';
import {Doodle} from '~/components/illustrations';
import type {DoodleName} from '~/components/illustrations';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

type DiscountCodeApplication = {
  code: string;
  applicable: boolean;
};

type GiftCardCode = {
  id: string;
  lastCharacters: string;
  amountUsed: MoneyLike;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  const summaryId = useId();
  const discountsHeadingId = useId();
  const discountCodeInputId = useId();
  const giftCardHeadingId = useId();
  const giftCardInputId = useId();
  const termsCheckboxId = useId();
  const termsHintId = useId();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsNudge, setTermsNudge] = useState(false);
  const {dict} = useI18n();
  const hasCodes = Boolean(
    cart?.discountCodes?.some((d) => d.applicable) ||
      cart?.appliedGiftCards?.length,
  );

  return (
    <div aria-labelledby={summaryId} className={className}>
      <h2 id={summaryId} className="cart-summary-heading">
        {dict.cart.totals}
      </h2>
      <dl className="cart-subtotal">
        <dt>{dict.cart.subtotal}</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Price data={cart.cost.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
      {cart?.checkoutUrl && (
        <TermsAgreement
          checked={termsAgreed}
          onChange={(checked) => {
            setTermsAgreed(checked);
            if (checked) setTermsNudge(false);
          }}
          agreementId={termsCheckboxId}
          hintId={termsHintId}
          showHint={!termsAgreed}
          nudge={termsNudge}
        />
      )}
      <CartCheckoutActions
        checkoutUrl={cart?.checkoutUrl}
        total={cart?.cost?.subtotalAmount}
        agreed={termsAgreed}
        hintId={termsHintId}
        onBlocked={() => {
          setTermsNudge(true);
          document.getElementById(termsCheckboxId)?.focus();
        }}
      />
      {/* One quiet disclosure instead of two always-open forms with dark
          buttons competing with checkout. Opens itself when a code is
          already applied so it can be removed. */}
      <details className="cart-codes" open={hasCodes || undefined}>
        <summary>{dict.cart.discountToggle}</summary>
        <CartDiscounts
          discountCodes={cart?.discountCodes as DiscountCodeApplication[] | undefined}
          discountsHeadingId={discountsHeadingId}
          discountCodeInputId={discountCodeInputId}
        />
        <CartGiftCard
          giftCardCodes={cart?.appliedGiftCards as GiftCardCode[] | undefined}
          giftCardHeadingId={giftCardHeadingId}
          giftCardInputId={giftCardInputId}
        />
      </details>
    </div>
  );
}

/**
 * Grow Payments and Israeli ecommerce best practice both require an explicit
 * agreement to the תקנון before the customer reaches the payment page. Standard
 * Shopify (non-Plus) doesn't expose a built-in checkout T&C checkbox, so we gate
 * the storefront-side checkout link instead — equivalent intent, customer cannot
 * reach the payment page without an explicit acceptance.
 */
function TermsAgreement({
  checked,
  onChange,
  agreementId,
  hintId,
  showHint,
  nudge,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  agreementId: string;
  hintId: string;
  showHint: boolean;
  nudge: boolean;
}) {
  const {dict, to} = useI18n();
  const t = dict.cart.terms ?? {};
  return (
    <div className={`cart-terms${nudge ? ' is-nudged' : ''}`}>
      <label htmlFor={agreementId} className="cart-terms-label">
        <input
          id={agreementId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={showHint ? hintId : undefined}
          required
        />
        <span>
          {t.prefix ?? 'I agree to the '}
          <a
            href={to('/policies/terms-of-service')}
            target="_blank"
            rel="noreferrer"
          >
            {t.linkLabel ?? 'terms of service'}
          </a>
          {t.suffix ?? ''}
        </span>
      </label>
      {showHint ? (
        <p id={hintId} className="cart-terms-hint" role={nudge ? 'alert' : undefined}>
          {t.requiredHint ?? 'Please agree to the terms to continue to checkout'}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The money action: always a full-width primary button. Until the terms box
 * is ticked it stays visible (never a ghosted text link) but is
 * aria-disabled, points at the hint, and moves focus to the checkbox.
 */
function CartCheckoutActions({
  checkoutUrl,
  total,
  agreed,
  hintId,
  onBlocked,
}: {
  checkoutUrl?: string | null;
  total?: MoneyLike | null;
  agreed: boolean;
  hintId: string;
  onBlocked: () => void;
}) {
  const {dict} = useI18n();
  if (!checkoutUrl) return null;
  const content = (
    <>
      <LockIcon />
      <span>{dict.cart.checkout}</span>
      {total?.amount ? (
        <>
          <span aria-hidden="true">·</span>
          <Price data={total} />
        </>
      ) : null}
    </>
  );
  return (
    <div className="cart-checkout">
      {agreed ? (
        <a href={checkoutUrl} target="_self" className="cart-checkout-btn">
          {content}
        </a>
      ) : (
        <button
          type="button"
          className="cart-checkout-btn is-blocked"
          aria-disabled="true"
          aria-describedby={hintId}
          onClick={onBlocked}
        >
          {content}
        </button>
      )}
      <p className="cart-checkout-note">{dict.cart.checkoutSecure}</p>
      <CartTrust />
    </div>
  );
}

/** Small doodle trust row under the checkout CTA (drawer + /cart). */
function CartTrust() {
  const {dict} = useI18n();
  const items = (dict.cart.trust ?? []) as Array<{icon: string; label: string}>;
  if (items.length === 0) return null;
  return (
    <ul className="cart-trust" role="list">
      {items.map((item) => (
        <li key={item.label}>
          <Doodle name={item.icon as DoodleName} size={20} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function CartDiscounts({
  discountCodes,
  discountsHeadingId,
  discountCodeInputId,
}: {
  discountCodes?: DiscountCodeApplication[];
  discountsHeadingId: string;
  discountCodeInputId: string;
}) {
  const {dict} = useI18n();
  const codes =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <section aria-label={dict.cart.discountsLabel}>
      <dl hidden={!codes.length}>
        <div>
          <dt id={discountsHeadingId}>{dict.cart.discounts}</dt>
          <UpdateDiscountForm>
            <div
              className="cart-discount"
              role="group"
              aria-labelledby={discountsHeadingId}
            >
              <code dir="ltr">{codes?.join(', ')}</code>
              <button
                type="submit"
                className="cart-code-remove"
                aria-label={dict.cart.discountRemove}
              >
                {dict.cart.removeBtn}
              </button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      <UpdateDiscountForm discountCodes={codes}>
        <div className="cart-code-row">
          <label htmlFor={discountCodeInputId} className="sr-only">
            {dict.cart.discountCode}
          </label>
          <input
            id={discountCodeInputId}
            type="text"
            name="discountCode"
            placeholder={dict.cart.discountCode}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="cart-code-apply"
            aria-label={dict.cart.discountApplyAria}
          >
            {dict.cart.applyBtn}
          </button>
        </div>
      </UpdateDiscountForm>
    </section>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartGiftCard({
  giftCardCodes,
  giftCardHeadingId,
  giftCardInputId,
}: {
  giftCardCodes?: GiftCardCode[];
  giftCardHeadingId: string;
  giftCardInputId: string;
}) {
  const giftCardCodeInput = useRef<HTMLInputElement | null>(null);
  const removeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const previousCardIdsRef = useRef<string[]>([]);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});
  const [removedCardIndex, setRemovedCardIndex] = useState<number | null>(null);
  const {dict} = useI18n();

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      if (giftCardCodeInput.current !== null) {
        giftCardCodeInput.current.value = '';
      }
    }
  }, [giftCardAddFetcher.data]);

  useEffect(() => {
    const currentCardIds = giftCardCodes?.map((card) => card.id) || [];

    if (removedCardIndex !== null && giftCardCodes) {
      const focusTargetIndex = Math.min(
        removedCardIndex,
        giftCardCodes.length - 1,
      );
      const focusTargetCard = giftCardCodes[focusTargetIndex];
      const focusButton = focusTargetCard
        ? removeButtonRefs.current.get(focusTargetCard.id)
        : null;

      if (focusButton) {
        focusButton.focus();
      } else if (giftCardCodeInput.current) {
        giftCardCodeInput.current.focus();
      }

      setRemovedCardIndex(null);
    }

    previousCardIdsRef.current = currentCardIds;
  }, [giftCardCodes, removedCardIndex]);

  const handleRemoveClick = (cardId: string) => {
    const index = previousCardIdsRef.current.indexOf(cardId);
    if (index !== -1) {
      setRemovedCardIndex(index);
    }
  };

  return (
    <section aria-label={dict.cart.giftCardsLabel}>
      {giftCardCodes && giftCardCodes.length > 0 && (
        <dl>
          <dt id={giftCardHeadingId}>{dict.cart.giftCardsApplied}</dt>
          {giftCardCodes.map((giftCard) => (
            <dd key={giftCard.id} className="cart-discount">
              <RemoveGiftCardForm
                giftCardId={giftCard.id}
                lastCharacters={giftCard.lastCharacters}
                onRemoveClick={() => handleRemoveClick(giftCard.id)}
                buttonRef={(el) => {
                  if (el) {
                    removeButtonRefs.current.set(giftCard.id, el);
                  } else {
                    removeButtonRefs.current.delete(giftCard.id);
                  }
                }}
              >
                <code>***{giftCard.lastCharacters}</code>
                &nbsp;
                <Price data={giftCard.amountUsed} />
              </RemoveGiftCardForm>
            </dd>
          ))}
        </dl>
      )}

      <AddGiftCardForm fetcherKey="gift-card-add">
        <div className="cart-code-row">
          <label htmlFor={giftCardInputId} className="sr-only">
            {dict.cart.giftCardCode}
          </label>
          <input
            id={giftCardInputId}
            type="text"
            name="giftCardCode"
            placeholder={dict.cart.giftCardCode}
            ref={giftCardCodeInput}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="cart-code-apply"
            disabled={giftCardAddFetcher.state !== 'idle'}
            aria-label={dict.cart.giftCardCodeAria}
          >
            {dict.cart.applyBtn}
          </button>
        </div>
      </AddGiftCardForm>
    </section>
  );
}

function AddGiftCardForm({
  fetcherKey,
  children,
}: {
  fetcherKey: string;
  children: ReactNode;
}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
    >
      {children}
    </CartForm>
  );
}

function RemoveGiftCardForm({
  giftCardId,
  lastCharacters,
  children,
  onRemoveClick,
  buttonRef,
}: {
  giftCardId: string;
  lastCharacters: string;
  children: ReactNode;
  onRemoveClick: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  const {dict} = useI18n();
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
    >
      {children}
      <button
        type="submit"
        className="cart-code-remove"
        aria-label={`${dict.cart.giftCardRemove} ${lastCharacters}`}
        onClick={onRemoveClick}
        ref={buttonRef}
      >
        {dict.cart.removeBtn}
      </button>
    </CartForm>
  );
}
