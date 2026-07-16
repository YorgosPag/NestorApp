'use client';

/**
 * @fileoverview Sales Storage Viewer State Hook — ADR-199
 * @description State management for "Διαθέσιμες Αποθήκες" sales page
 * @pattern Storage-specific data + search on top of the shared
 *          `useSalesSpaceViewerState` SSoT
 */

import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import type { Storage } from '@/types/storage/contracts';
import type { SalesSpaceFilterState } from '@/types/sales-shared';
import { useSalesSpaceViewerState } from './useSalesSpaceViewerState';

// =============================================================================
// 🏢 DEFAULTS
// =============================================================================

const DEFAULT_FILTERS: SalesSpaceFilterState = {
  searchTerm: '',
  status: 'all',
  type: 'all',
  building: 'all',
  floor: 'all',
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 STORAGE-SPECIFIC PREDICATES
// =============================================================================
// Declared at module scope so their identity is stable across renders — the
// shared hook memoizes filtering on them.

function matchesStorageSearch(storage: Storage, term: string): boolean {
  return Boolean(
    storage.name?.toLowerCase().includes(term) ||
    storage.building?.toLowerCase().includes(term) ||
    storage.type?.toLowerCase().includes(term) ||
    storage.floor?.toLowerCase().includes(term) ||
    storage.description?.toLowerCase().includes(term)
  );
}

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesStorageViewerState() {
  const { storages, loading, refetch } = useFirestoreStorages();

  return useSalesSpaceViewerState<Storage, SalesSpaceFilterState>({
    items: storages,
    loading,
    refetch,
    defaultFilters: DEFAULT_FILTERS,
    matchesSearch: matchesStorageSearch,
  });
}
