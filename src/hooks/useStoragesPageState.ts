'use client';

/**
 * ADR-203: Storages Page State — thin wrapper around useEntityPageState
 *
 * Entity-specific concerns:
 * - URL param: storageId
 * - Filter logic: storage-specific filters (building, floor, project, nested ranges + date range)
 */

import { useCallback } from 'react';
import type { Storage } from '@/types/storage/contracts';
import { defaultStorageFilters, type StorageFilterState } from '@/components/core/AdvancedFilters/configs/storageFiltersConfig';
import { useEntityPageState, type EntityPageStateConfig } from './useEntityPageState';

// ---------------------------------------------------------------------------
// Filter function
// ---------------------------------------------------------------------------

function filterStorages(storages: Storage[], filters: StorageFilterState): Storage[] {
  return storages.filter((storage) => {
    // Search filter
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      const matches =
        storage.name.toLowerCase().includes(s) ||
        storage.description?.toLowerCase().includes(s) ||
        storage.building?.toLowerCase().includes(s) ||
        storage.floor?.toLowerCase().includes(s) ||
        storage.type?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    // Select filters
    const statusVal = filters.status?.[0];
    if (statusVal && statusVal !== 'all' && storage.status !== statusVal) return false;

    const typeVal = filters.type?.[0];
    if (typeVal && typeVal !== 'all' && storage.type !== typeVal) return false;

    const buildingVal = filters.building?.[0];
    if (buildingVal && buildingVal !== 'all' && storage.building !== buildingVal) return false;

    const floorVal = filters.floor?.[0];
    if (floorVal && floorVal !== 'all' && storage.floor !== floorVal) return false;

    const projectVal = filters.project?.[0];
    if (projectVal && projectVal !== 'all' && storage.projectId !== projectVal) return false;

    // Nested range filters
    const areaRange = filters.ranges?.areaRange;
    if (areaRange?.min !== undefined && storage.area && storage.area < areaRange.min) return false;
    if (areaRange?.max !== undefined && storage.area && storage.area > areaRange.max) return false;

    const priceRange = filters.ranges?.priceRange;
    if (priceRange?.min !== undefined && storage.price && storage.price < priceRange.min) return false;
    if (priceRange?.max !== undefined && storage.price && storage.price > priceRange.max) return false;

    // Date range filter
    const dateRange = filters.ranges?.dateRange;
    if (dateRange?.start && storage.lastUpdated) {
      if (new Date(storage.lastUpdated) < dateRange.start) return false;
    }
    if (dateRange?.end && storage.lastUpdated) {
      if (new Date(storage.lastUpdated) > dateRange.end) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStoragesPageState(initialStorages: Storage[]) {
  const stableFilterFn = useCallback(filterStorages, []);

  const config: EntityPageStateConfig<Storage, StorageFilterState> = {
    urlParamName: 'storageId',
    loggerName: 'useStoragesPageState',
    defaultFilters: defaultStorageFilters,
    filterFn: stableFilterFn,
    autoSelectFirstItem: false,
  };

  const {
    selectedItem,
    setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredItems,
    filters,
    setFilters,
  } = useEntityPageState(initialStorages, config);

  return {
    selectedStorage: selectedItem,
    setSelectedStorage: setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredStorages: filteredItems,
    filters,
    setFilters,
  };
}
