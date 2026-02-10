'use client';

/**
 * 🅿️ ENTERPRISE PARKING PAGE STATE HOOK
 *
 * State management για τη σελίδα θέσεων στάθμευσης
 * Ακολουθεί το exact pattern από useStoragesPageState.ts
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md):
 * - Parking είναι παράλληλη κατηγορία με Units/Storage μέσα στο Building
 * - ΟΧΙ children των Units
 * - Ισότιμη οντότητα στην πλοήγηση
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ParkingSpot } from './useFirestoreParkingSpots';
import { defaultParkingFilters, type ParkingFilterState } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useParkingPageState');

export function useParkingPageState(initialParkingSpots: ParkingSpot[]) {
  // 🏢 ENTERPRISE: URL parameter handling for contextual navigation
  const searchParams = useSearchParams();
  const parkingIdFromUrl = searchParams.get('parkingId');

  const [selectedParking, setSelectedParking] = useState<ParkingSpot | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<ParkingFilterState>(defaultParkingFilters);

  // 🏢 ENTERPRISE: Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (!initialParkingSpots.length) return;

    if (parkingIdFromUrl) {
      // URL parameter has priority - find and select the parking spot
      const found = initialParkingSpots.find(p => p.id === parkingIdFromUrl);
      if (found) {
        logger.info('Auto-selecting parking from URL', { parkingNumber: found.number });
        setSelectedParking(found);
        return;
      }
    }

    // Default: select first parking if none selected
    if (!selectedParking && initialParkingSpots.length > 0) {
      setSelectedParking(initialParkingSpots[0]);
    }
  }, [initialParkingSpots, parkingIdFromUrl]);

  const filteredParkingSpots = useMemo(() => {
    return initialParkingSpots.filter(parking => {
      // Search filter - εκτεταμένη αναζήτηση
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          parking.number?.toLowerCase().includes(searchLower) ||
          parking.location?.toLowerCase().includes(searchLower) ||
          parking.floor?.toLowerCase().includes(searchLower) ||
          parking.notes?.toLowerCase().includes(searchLower) ||
          parking.type?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      const statusFilter = filters.status && filters.status.length > 0 ? filters.status[0] : null;
      if (statusFilter && statusFilter !== 'all' && parking.status !== statusFilter) {
        return false;
      }

      // Type filter
      const typeFilter = filters.type && filters.type.length > 0 ? filters.type[0] : null;
      if (typeFilter && typeFilter !== 'all' && parking.type !== typeFilter) {
        return false;
      }

      // Building filter
      const buildingFilter = filters.building && filters.building.length > 0 ? filters.building[0] : null;
      if (buildingFilter && buildingFilter !== 'all' && parking.buildingId !== buildingFilter) {
        return false;
      }

      // Floor filter
      const floorFilter = filters.floor && filters.floor.length > 0 ? filters.floor[0] : null;
      if (floorFilter && floorFilter !== 'all' && parking.floor !== floorFilter) {
        return false;
      }

      // Area range filter
      const areaRange = filters.ranges?.areaRange;
      if (areaRange?.min !== undefined && parking.area && parking.area < areaRange.min) {
        return false;
      }
      if (areaRange?.max !== undefined && parking.area && parking.area > areaRange.max) {
        return false;
      }

      return true;
    });
  }, [initialParkingSpots, filters]);

  return {
    selectedParking,
    setSelectedParking,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredParkingSpots,
    filters,
    setFilters,
  };
}
