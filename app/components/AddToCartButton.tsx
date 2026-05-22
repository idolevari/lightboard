import type {ReactNode} from 'react';
import {CartForm} from '@shopify/hydrogen';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';

type AddToCartButtonProps = {
  analytics?: unknown;
  children: ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
};

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
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
            type="submit"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </>
      )}
    </CartForm>
  );
}
