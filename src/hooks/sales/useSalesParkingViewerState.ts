'use client';

/**
 * @fileoverview Sales Parking Viewer State Hook — ADR-199
 * @description State management for "Διαθέσιμες Θέσεις Στάθμευσης" sales page
 * @pattern Parking-specific data + filters on top of the shared
 *          `useSalesSpaceViewerState` SSoT
 */

import { useFirestoreParkingSpots } from '@/hooks/useFirestoreParkingSpots';
import type { ParkingSpot } from '@/types/parking';
import type { SalesSpaceFilterState } from '@/types/sales-shared';
import { useSalesSpaceViewerState } from './useSalesSpaceViewerState';

// =============================================================================
// 🏢 EXTENDED FILTER (parking has locationZone)
// =============================================================================

export interface SalesParkingFilterState extends SalesSpaceFilterState {
  locationZone: string;
}

const DEFAULT_FILTERS: SalesParkingFilterState = {
  searchTerm: '',
  status: 'all',
  type: 'all',
  building: 'all',
  floor: 'all',
  locationZone: 'all',
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 PARKING-SPECIFIC PREDICATES
// =============================================================================
// Declared at module scope so their identity is stable across renders — the
// shared hook memoizes filtering on them.

function matchesParkingSearch(spot: ParkingSpot, term: string): boolean {
  return Boolean(
    spot.number?.toLowerCase().includes(term) ||
    spot.location?.toLowerCase().includes(term) ||
    spot.notes?.toLowerCase().includes(term) ||
    spot.floor?.toLowerCase().includes(term)
  );
}

function matchesParkingZone(spot: ParkingSpot, filters: SalesParkingFilterState): boolean {
  return filters.locationZone === 'all' || spot.locationZone === filters.locationZone;
}

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesParkingViewerState() {
  const { parkingSpots, loading, refetch } = useFirestoreParkingSpots();

  return useSalesSpaceViewerState<ParkingSpot, SalesParkingFilterState>({
    items: parkingSpots,
    loading,
    refetch,
    defaultFilters: DEFAULT_FILTERS,
    matchesSearch: matchesParkingSearch,
    matchesExtraFilters: matchesParkingZone,
  });
}
