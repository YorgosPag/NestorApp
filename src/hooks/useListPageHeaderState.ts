'use client';

/**
 * useListPageHeaderState — the search box and the mobile filter toggle, owned by the header.
 *
 * `ListPageHeader` renders a search field and a filters button, but holds no state for either — so
 * every list page declared `searchTerm` and `showFilters` itself and then spelled out all eleven
 * props on the way back down. Parking and Storages did it identically, which is what surfaced this:
 * the state was never the page's, it was the header's, parked one level too high.
 *
 * The page keeps supplying what it genuinely owns — the view mode, the dashboard toggle, its trash
 * binding — and gets back a ready `ListPageHeaderProps` to spread. `showFilters`/`setShowFilters`
 * come back out too, because the mobile filters slide-in is a sibling of the header, not a child.
 *
 * @module hooks/useListPageHeaderState
 * @enterprise ADR-584 — Anti-Duplication
 */

import { useState } from 'react';
import type { ListPageHeaderProps, ViewMode } from '@/core/headers';

/** What the PAGE owns. The rest of the header's props are this hook's own state. */
type ListPageHeaderSource<TViewMode extends ViewMode> = Omit<
  ListPageHeaderProps<TViewMode>,
  'searchTerm' | 'setSearchTerm' | 'showFilters' | 'setShowFilters'
>;

export interface ListPageHeaderState<TViewMode extends ViewMode> {
  /** Spread straight onto the page's header: `<ParkingsHeader {...headerProps} />`. */
  headerProps: ListPageHeaderProps<TViewMode>;
  /** The live search text, for pages that filter on it themselves. */
  searchTerm: string;
  /** Mobile filters visibility — shared with the page's filters slide-in. */
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

export function useListPageHeaderState<TViewMode extends ViewMode = ViewMode>(
  source: ListPageHeaderSource<TViewMode>,
): ListPageHeaderState<TViewMode> {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Rebuilt each render, deliberately: `source` is a fresh literal at every call site, so memoising
  // on it would allocate a deps array to guard an allocation it can never actually skip. The page
  // spelled these props out inline before, which cost exactly the same.
  const headerProps: ListPageHeaderProps<TViewMode> = {
    ...source,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
  };

  return { headerProps, searchTerm, showFilters, setShowFilters };
}
