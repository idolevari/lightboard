import {useRef, useEffect} from 'react';
import type {ReactNode, RefObject} from 'react';
import {Form} from 'react-router';
import type {FormProps} from 'react-router';

type SearchFormChildren = (args: {
  inputRef: RefObject<HTMLInputElement>;
}) => ReactNode;

type SearchFormProps = Omit<FormProps, 'children'> & {
  children: SearchFormChildren;
};

/**
 * Search form component that sends search requests to the `/search` route.
 */
export function SearchForm({children, ...props}: SearchFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useFocusOnCmdK(inputRef);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <Form method="get" {...props}>
      {children({inputRef: inputRef as RefObject<HTMLInputElement>})}
    </Form>
  );
}

/**
 * Focuses the input when cmd+k is pressed
 */
function useFocusOnCmdK(inputRef: RefObject<HTMLInputElement | null>) {
  // focus the input when cmd+k is pressed
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && event.metaKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === 'Escape') {
        inputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef]);
}
