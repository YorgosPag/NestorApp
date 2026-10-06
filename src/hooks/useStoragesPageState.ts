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
import { resolveStorageById, isTrashedEntity } from './entity-deep-link-sources';
import { matchesSpaceStatusFilters } from '@/lib/spaces/space-availability';
import { matchesPriceRange } from '@/lib/properties/price-range';
import { useFloorLabel, type FloorLabelInput } from '@/hooks/useFloorLabel';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';
import { matchesFloorFilter } from '@/lib/floor/floor-filter';
import {
  useEntityPageState,
  type EntityPageStateConfig,
  type EntityPageStateOptions,
} from './useEntityPageState';

// ---------------------------------------------------------------------------
// Filter function
// ---------------------------------------------------------------------------

function filterStorages(
  storages: Storage[],
  filters: StorageFilterState,
  floorLabel: (value: FloorLabelInput) => string,
): Storage[] {
  return storages.filter((storage) => {
    // Search filter
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      const matches =
        storage.name.toLowerCase().includes(s) ||
        storage.description?.toLowerCase().includes(s) ||
        storage.building?.toLowerCase().includes(s) ||
        floorLabel(hostedFloorRef(storage)).toLowerCase().includes(s) ||
        storage.type?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    // Select filters
    // ADR-777 §8.60.20 — διάθεση + λειτουργία από το ΕΝΑ SSoT (όχι το παλιό ανάμεικτο `status`).
    if (!matchesSpaceStatusFilters(storage, filters)) return false;

    const typeVal = filters.type?.[0];
    if (typeVal && typeVal !== 'all' && storage.type !== typeVal) return false;

    const buildingVal = filters.building?.[0];
    if (buildingVal && buildingVal !== 'all' && storage.building !== buildingVal) return false;

    // ADR-903 §6 — κλειδί αριθμός:είδος (`floor-filter`)· ήταν slug (`basement-1`) απέναντι σε κείμενο ⇒ ποτέ ταίριασμα.
    if (!matchesFloorFilter(storage, filters.floor?.[0])) return false;

    const projectVal = filters.project?.[0];
    if (projectVal && projectVal !== 'all' && storage.projectId !== projectVal) return false;

    // Nested range filters
    const areaRange = filters.ranges?.areaRange;
    if (areaRange?.min !== undefined && storage.area && storage.area < areaRange.min) return false;
    if (areaRange?.max !== undefined && storage.area && storage.area > areaRange.max) return false;

    // ADR-777 Α6 + §8.60.14.14 — the price range carries its UNIT and is judged by the ONE
    // price rule. It read the @deprecated flat `storage.price` (any role, and `&& storage.price`
    // let every priceless storage through any bound).
    if (!matchesPriceRange(storage, filters.ranges?.priceRange)) return false;

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

export function useStoragesPageState(
  initialStorages: Storage[],
  options: EntityPageStateOptions<Storage>,
) {
  const floorLabel = useFloorLabel();
  const stableFilterFn = useCallback(
    (items: Storage[], filters: StorageFilterState) => filterStorages(items, filters, floorLabel),
    [floorLabel],
  );

  const config: EntityPageStateConfig<Storage, StorageFilterState> = {
    urlParamName: 'storageId',
    loggerName: 'useStoragesPageState',
    defaultFilters: defaultStorageFilters,
    filterFn: stableFilterFn,
    // ADR-777 §8.31 — προεπιλεγμένη πηγή για ταυτότητα ΕΚΤΟΣ φορτωμένης
    // λίστας (φιλτραρισμένη ή στον κάδο). Ο καλών μπορεί να την
    // παρακάμψει· το `...options` έρχεται ΜΕΤΑ επίτηδες.
    resolveById: resolveStorageById,
    isArchived: isTrashedEntity,
    // ADR-777 §8.31 — η ζωντανή κατάσταση της πηγής ταξιδεύει από τον καλούντα.
    ...options,
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
    selection,
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
    /** ADR-777 §8.31 — τι ζήτησε η διεύθυνση και τι βρέθηκε (ρητά). */
    selection,
  };
}
