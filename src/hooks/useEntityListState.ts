'use client';

/**
 * 📋 ENTITY LIST STATE — the local state every list page keeps
 *
 * Eleven list pages (parkings, storages, buildings, contacts, properties,
 * projects, vendors, materials, agreements, purchase orders, quotes) declare
 * the SAME six pieces of state plus the same favourite toggle, in the same
 * order, with the same types. CHECK 3.28 measured the block as one clone.
 *
 * This finishes the move `useSortState` started (ADR-205 Phase 4): that hook
 * centralised the sort pair and left the other six behind, so each page still
 * owned a private copy of "what a list page remembers".
 *
 * WHAT IT IS NOT: a store. The state stays local to the component, exactly as
 * before — a list page's search box is nobody else's business. Only the
 * DECLARATION is shared, so a page cannot accidentally type `selectedItems` as
 * `number[]` while its neighbour uses `string[]` (Firestore ids are strings).
 *
 * @module hooks/useEntityListState
 * @see hooks/useSortState — the sort half, centralised earlier
 */

import { useCallback, useState } from 'react';
import { useSortState, type SortState } from './useSortState';

/**
 * The state-driven half of a `<ResponsiveCompactToolbar>`'s props.
 *
 * Spread it and add only what is page-specific (`config`, the action handlers).
 * Wiring these nine by hand is what every list page used to do, identically —
 * and it is where a page could bind the toolbar's search box to one piece of
 * state while its list filtered on another.
 */
export interface EntityListToolbarBindings<TSort extends string = string> {
  showOnMobile: boolean;
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilters: string[];
  onFiltersChange: (filters: string[]) => void;
  sortBy: TSort;
  onSortChange: (field: TSort, order: 'asc' | 'desc') => void;
}

export interface EntityListState<TSort extends string = string> extends SortState<TSort> {
  /** Ready-to-spread props for the toolbar — see {@link EntityListToolbarBindings}. */
  toolbarBindings: EntityListToolbarBindings<TSort>;
  /** Ids marked as favourite. */
  favorites: string[];
  /** Adds the id if absent, removes it if present. */
  toggleFavorite: (id: string) => void;
  /** Free-text search box. */
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  /** Ids picked via checkboxes — strings, because Firestore ids are strings. */
  selectedItems: string[];
  setSelectedItems: (items: string[]) => void;
  /** Active filter chips from the toolbar. */
  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;
  /** Whether the mobile toolbar is expanded. */
  showToolbar: boolean;
  setShowToolbar: (show: boolean) => void;
  /** Selected values of the quick status/type filter row. */
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
}

export interface UseEntityListStateOptions<TSort extends string> {
  /** Column the list is sorted by on first render. */
  defaultSortField: TSort;
  /** Initial sort direction (default: `'asc'`). */
  defaultSortOrder?: 'asc' | 'desc';
  /** Ids favourited from the start — a few pages seed a demo id. */
  initialFavorites?: string[];
}

export function useEntityListState<TSort extends string = string>({
  defaultSortField,
  defaultSortOrder = 'asc',
  initialFavorites = [],
}: UseEntityListStateOptions<TSort>): EntityListState<TSort> {
  const sort = useSortState<TSort>(defaultSortField, defaultSortOrder);

  const [favorites, setFavorites] = useState<string[]>(initialFavorites);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  return {
    ...sort,
    toolbarBindings: {
      showOnMobile: showToolbar,
      selectedItems,
      onSelectionChange: setSelectedItems,
      searchTerm,
      onSearchChange: setSearchTerm,
      activeFilters,
      onFiltersChange: setActiveFilters,
      sortBy: sort.sortBy,
      onSortChange: sort.onSortChange,
    },
    favorites,
    toggleFavorite,
    searchTerm,
    setSearchTerm,
    selectedItems,
    setSelectedItems,
    activeFilters,
    setActiveFilters,
    showToolbar,
    setShowToolbar,
    selectedStatuses,
    setSelectedStatuses,
  };
}
