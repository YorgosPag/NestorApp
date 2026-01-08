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

import { useState, useMemo } from 'react';
import type { ParkingSpot } from './useFirestoreParkingSpots';
import { defaultParkingFilters, type ParkingFilterState } from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

export function useParkingPageState(initialParkingSpots: ParkingSpot[]) {
  const [selectedParking, setSelectedParking] = useState<ParkingSpot | null>(
    initialParkingSpots.length > 0 ? initialParkingSpots[0] : null
  );
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<ParkingFilterState>(defaultParkingFilters);

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
