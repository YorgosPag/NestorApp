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
import { EMPTY_PRICE_RANGE } from '@/lib/properties/price-range';
import { useCallback } from 'react';
import { useFloorLabel, type FloorLabelInput } from '@/hooks/useFloorLabel';
import { hostedFloorRef } from '@/lib/floor/hosted-floor';

type FloorLabelFn = (value: FloorLabelInput) => string;

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
  priceRange: EMPTY_PRICE_RANGE,
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 PARKING-SPECIFIC PREDICATES
// =============================================================================
// Declared at module scope so their identity is stable across renders — the
// shared hook memoizes filtering on them.

function matchesParkingSearch(spot: ParkingSpot, term: string, floorLabel: FloorLabelFn): boolean {
  return Boolean(
    spot.number?.toLowerCase().includes(term) ||
    spot.location?.toLowerCase().includes(term) ||
    spot.notes?.toLowerCase().includes(term) ||
    // ADR-903 §6 — αναζήτηση στην ΕΤΙΚΕΤΑ («υπόγειο»), όχι στον ωμό αριθμό.
    floorLabel(hostedFloorRef(spot)).toLowerCase().includes(term)
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
  const floorLabel = useFloorLabel();
  const matchesSearch = useCallback(
    (spot: ParkingSpot, term: string) => matchesParkingSearch(spot, term, floorLabel),
    [floorLabel],
  );

  return useSalesSpaceViewerState<ParkingSpot, SalesParkingFilterState>({
    items: parkingSpots,
    loading,
    refetch,
    defaultFilters: DEFAULT_FILTERS,
    matchesSearch,
    matchesExtraFilters: matchesParkingZone,
  });
}
