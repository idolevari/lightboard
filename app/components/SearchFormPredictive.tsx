import {useFetcher, useNavigate} from 'react-router';
import type {FetcherWithComponents, FormProps} from 'react-router';
import {useRef, useEffect} from 'react';
import type {ChangeEvent, FormEvent, MutableRefObject, ReactNode} from 'react';
import {useAside} from './Aside';
import type {PredictiveSearchReturn} from '~/lib/search';

export const SEARCH_ENDPOINT = '/search';

type SearchFormPredictiveChildren = (args: {
  fetchResults: (event: ChangeEvent<HTMLInputElement>) => void;
  goToSearch: () => void;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  fetcher: FetcherWithComponents<PredictiveSearchReturn>;
}) => ReactNode;

type SearchFormPredictiveProps = Omit<FormProps, 'children'> & {
  children: SearchFormPredictiveChildren | null;
  className?: string;
};

/**
 *  Search form component that sends search requests to the `/search` route
 */
export function SearchFormPredictive({
  children,
  className = 'predictive-search-form',
  ...props
}: SearchFormPredictiveProps) {
  const fetcher = useFetcher<PredictiveSearchReturn>({key: 'search'});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const aside = useAside();

  /** Reset the input value and blur the input */
  function resetInput(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef?.current?.value) {
      inputRef.current.blur();
    }
  }

  /** Navigate to the search page with the current input value */
  function goToSearch() {
    const term = inputRef?.current?.value;
    void navigate(SEARCH_ENDPOINT + (term ? `?q=${term}` : ''));
    aside.close();
  }

  /** Fetch search results based on the input value */
  function fetchResults(event: ChangeEvent<HTMLInputElement>) {
    void fetcher.submit(
      {q: event.target.value || '', limit: 5, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form {...props} className={className} onSubmit={resetInput}>
      {children({inputRef, fetcher, fetchResults, goToSearch})}
    </fetcher.Form>
  );
}
