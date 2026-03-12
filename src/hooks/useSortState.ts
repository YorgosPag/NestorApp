import { useCallback, useState } from 'react';

/**
 * Return type for useSortState — provides sort field, order, and a change handler.
 *
 * @see ADR-205 Phase 4 — useSortState centralization
 */
export interface SortState<T extends string = string> {
  sortBy: T;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: T, order: 'asc' | 'desc') => void;
}

/**
 * Centralized hook for list sort state.
 * Replaces duplicated `useState<SortField>` + `useState<'asc'|'desc'>` pairs across list pages.
 *
 * @param defaultField — initial sort field
 * @param defaultOrder — initial sort direction (default: 'asc')
 */
export function useSortState<T extends string = string>(
  defaultField: T,
  defaultOrder: 'asc' | 'desc' = 'asc',
): SortState<T> {
  const [sortBy, setSortBy] = useState<T>(defaultField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultOrder);

  const onSortChange = useCallback((field: T, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  }, []);

  return { sortBy, sortOrder, onSortChange };
}
