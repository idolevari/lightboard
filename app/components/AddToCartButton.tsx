import type {ReactNode, Ref} from 'react';
import {CartForm} from '@shopify/hydrogen';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';

type AddToCartButtonProps = {
  analytics?: unknown;
  children: ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  className?: string;
  buttonRef?: Ref<HTMLButtonElement>;
};

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  className,
  buttonRef,
}: AddToCartButtonProps) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            ref={buttonRef}
            type="submit"
            className={className}
            onClick={onClick}
            disabled={disabled || fetcher.state !== 'idle'}
            aria-busy={fetcher.state !== 'idle' || undefined}
          >
            {children}
          </button>
        </>
      )}
    </CartForm>
  );
}
