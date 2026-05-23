import {CartForm, Money} from '@shopify/hydrogen';
import type {OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useId, useRef, useState} from 'react';
import type {ReactNode, Ref} from 'react';
import {useFetcher} from 'react-router';
import {useI18n} from '~/lib/useI18n';
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
  amountUsed: React.ComponentProps<typeof Money>['data'];
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
  const [termsAgreed, setTermsAgreed] = useState(false);
  const {dict} = useI18n();

  return (
    <div aria-labelledby={summaryId} className={className}>
      <h4 id={summaryId}>{dict.cart.totals}</h4>
      <dl role="group" className="cart-subtotal">
        <dt>{dict.cart.subtotal}</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money data={cart.cost.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
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
      {cart?.checkoutUrl && (
        <TermsAgreement
          checked={termsAgreed}
          onChange={setTermsAgreed}
          agreementId={termsCheckboxId}
        />
      )}
      <CartCheckoutActions
        checkoutUrl={cart?.checkoutUrl}
        disabled={!termsAgreed}
      />
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
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  agreementId: string;
}) {
  const {dict, to} = useI18n();
  const t = dict.cart.terms ?? {};
  return (
    <div className="cart-terms">
      <label htmlFor={agreementId} className="cart-terms-label">
        <input
          id={agreementId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
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
    </div>
  );
}

function CartCheckoutActions({
  checkoutUrl,
  disabled,
}: {
  checkoutUrl?: string | null;
  disabled: boolean;
}) {
  const {dict} = useI18n();
  if (!checkoutUrl) return null;
  const t = dict.cart.terms ?? {};
  if (disabled) {
    return (
      <div>
        <button
          type="button"
          className="cart-checkout-disabled"
          disabled
          aria-disabled="true"
          title={t.requiredHint ?? 'Please agree to the terms to continue'}
        >
          <p>{dict.cart.checkout}</p>
        </button>
        <br />
      </div>
    );
  }
  return (
    <div>
      <a href={checkoutUrl} target="_self">
        <p>{dict.cart.checkout}</p>
      </a>
      <br />
    </div>
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
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <button type="submit" aria-label={dict.cart.discountRemove}>
                {dict.cart.removeBtn}
              </button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      <UpdateDiscountForm discountCodes={codes}>
        <div>
          <label htmlFor={discountCodeInputId} className="sr-only">
            {dict.cart.discountCode}
          </label>
          <input
            id={discountCodeInputId}
            type="text"
            name="discountCode"
            placeholder={dict.cart.discountCode}
          />
          &nbsp;
          <button type="submit" aria-label={dict.cart.discountApplyAria}>
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
                <Money data={giftCard.amountUsed} />
              </RemoveGiftCardForm>
            </dd>
          ))}
        </dl>
      )}

      <AddGiftCardForm fetcherKey="gift-card-add">
        <div>
          <label htmlFor={giftCardInputId} className="sr-only">
            {dict.cart.giftCardCode}
          </label>
          <input
            id={giftCardInputId}
            type="text"
            name="giftCardCode"
            placeholder={dict.cart.giftCardCode}
            ref={giftCardCodeInput}
          />
          &nbsp;
          <button
            type="submit"
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
      &nbsp;
      <button
        type="submit"
        aria-label={`${dict.cart.giftCardRemove} ${lastCharacters}`}
        onClick={onRemoveClick}
        ref={buttonRef}
      >
        {dict.cart.removeBtn}
      </button>
    </CartForm>
  );
}
