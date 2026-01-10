'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Property } from '@/types/property-viewer';

// Units filter state interface
export interface UnitsFilterState {
  searchTerm: string;
  status: string[];
  type: string[];
  priceRange: [number, number];
  areaRange: [number, number];
}

// Default filter state
export const defaultUnitsFilters: UnitsFilterState = {
  searchTerm: '',
  status: [],
  type: [],
  priceRange: [0, 1000000],
  areaRange: [0, 500]
};

export function useUnitsPageState(initialUnits: Property[]) {
  // 🏢 ENTERPRISE: URL parameter handling for contextual navigation
  const searchParams = useSearchParams();
  const unitIdFromUrl = searchParams.get('unitId');

  const [selectedUnit, setSelectedUnit] = useState<Property | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<UnitsFilterState>(defaultUnitsFilters);

  // 🏢 ENTERPRISE: Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (!initialUnits.length) return;

    if (unitIdFromUrl) {
      // URL parameter has priority - find and select the unit
      const found = initialUnits.find(u => u.id === unitIdFromUrl);
      if (found) {
        console.log('🏠 [useUnitsPageState] Auto-selecting unit from URL:', found.name);
        setSelectedUnit(found);
        return;
      }
    }

    // Default: select first unit if none selected
    if (!selectedUnit && initialUnits.length > 0) {
      setSelectedUnit(initialUnits[0]);
    }
  }, [initialUnits, unitIdFromUrl]);

  const filteredUnits = useMemo(() => {
    return initialUnits.filter(unit => {
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = unit.name.toLowerCase().includes(searchLower) ||
                             unit.description?.toLowerCase().includes(searchLower) ||
                             unit.type?.toLowerCase().includes(searchLower) ||
                             unit.status?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        const hasValidStatus = filters.status.some(status =>
          status === 'all' || unit.status === status
        );
        if (!hasValidStatus) return false;
      }

      // Type filter
      if (filters.type && filters.type.length > 0) {
        const hasValidType = filters.type.some(type =>
          type === 'all' || unit.type === type
        );
        if (!hasValidType) return false;
      }

      // Price range filter
      const unitPrice = unit.price || 0;
      if (unitPrice < filters.priceRange[0] || unitPrice > filters.priceRange[1]) {
        return false;
      }

      // Area range filter
      const unitArea = unit.area || 0;
      if (unitArea < filters.areaRange[0] || unitArea > filters.areaRange[1]) {
        return false;
      }

      return true;
    });
  }, [initialUnits, filters]);

  return {
    selectedUnit,
    setSelectedUnit,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredUnits,
    filters,
    setFilters,
  };
}