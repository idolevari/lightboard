import {Pagination} from '@shopify/hydrogen';
import type {ComponentProps, ReactNode} from 'react';
import {useI18n} from '~/lib/useI18n';

type PaginationConnection<NodesType> = ComponentProps<
  typeof Pagination<NodesType>
>['connection'];

type PaginatedResourceSectionProps<NodesType> = {
  connection: PaginationConnection<NodesType>;
  children: (args: {node: NodesType; index: number}) => ReactNode;
  ariaLabel?: string;
  resourcesClassName?: string;
};

/**
 * <PaginatedResourceSection> encapsulates the previous and next pagination behaviors throughout your application.
 */
export function PaginatedResourceSection<NodesType>({
  connection,
  children,
  ariaLabel,
  resourcesClassName,
}: PaginatedResourceSectionProps<NodesType>) {
  const {dict} = useI18n();
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        return (
          <div>
            <PreviousLink>
              {isLoading ? (
                dict.pagination.loading
              ) : (
                <span>
                  <span aria-hidden="true">↑</span> {dict.pagination.loadPrevious}
                </span>
              )}
            </PreviousLink>
            {resourcesClassName ? (
              <div
                aria-label={ariaLabel}
                className={resourcesClassName}
                role={ariaLabel ? 'region' : undefined}
              >
                {resourcesMarkup}
              </div>
            ) : (
              resourcesMarkup
            )}
            <NextLink>
              {isLoading ? (
                dict.pagination.loading
              ) : (
                <span>
                  {dict.pagination.loadMore} <span aria-hidden="true">↓</span>
                </span>
              )}
            </NextLink>
          </div>
        );
      }}
    </Pagination>
  );
}
