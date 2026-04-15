'use client';

/**
 * ADR-203: Parking Page State — thin wrapper around useEntityPageState
 *
 * Entity-specific concerns:
 * - URL param: parkingId
 * - Filter logic: parking-specific filters (floor, buildingId, nested ranges)
 */

import { useCallback } from 'react';
import type { ParkingSpot } from './useFirestoreParkingSpots';
import { defaultParkingFilters, type ParkingFilterState } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { useEntityPageState, type EntityPageStateConfig } from './useEntityPageState';

// ---------------------------------------------------------------------------
// Filter function
// ---------------------------------------------------------------------------

function filterParkingSpots(parkingSpots: ParkingSpot[], filters: ParkingFilterState): ParkingSpot[] {
  return parkingSpots.filter((parking) => {
    // Search filter
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      const matches =
        parking.number?.toLowerCase().includes(s) ||
        parking.location?.toLowerCase().includes(s) ||
        parking.floor?.toLowerCase().includes(s) ||
        parking.notes?.toLowerCase().includes(s) ||
        parking.type?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    // Select filters
    const statusVal = filters.status?.[0];
    if (statusVal && statusVal !== 'all' && parking.status !== statusVal) return false;

    const typeVal = filters.type?.[0];
    if (typeVal && typeVal !== 'all' && parking.type !== typeVal) return false;

    const buildingVal = filters.building?.[0];
    if (buildingVal && buildingVal !== 'all' && parking.buildingId !== buildingVal) return false;

    const floorVal = filters.floor?.[0];
    if (floorVal && floorVal !== 'all' && parking.floor !== floorVal) return false;

    // Nested range filters
    const areaRange = filters.ranges?.areaRange;
    if (areaRange?.min !== undefined && parking.area && parking.area < areaRange.min) return false;
    if (areaRange?.max !== undefined && parking.area && parking.area > areaRange.max) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useParkingPageState(initialParkingSpots: ParkingSpot[]) {
  const stableFilterFn = useCallback(filterParkingSpots, []);

  const config: EntityPageStateConfig<ParkingSpot, ParkingFilterState> = {
    urlParamName: 'parkingId',
    loggerName: 'useParkingPageState',
    defaultFilters: defaultParkingFilters,
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
  } = useEntityPageState(initialParkingSpots, config);

  return {
    selectedParking: selectedItem,
    setSelectedParking: setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredParkingSpots: filteredItems,
    filters,
    setFilters,
  };
}
