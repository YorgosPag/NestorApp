'use client';

/**
 * @fileoverview Sales Units Viewer State Hook — ADR-197
 * @description State management for the "Διαθέσιμες Μονάδες" sales page
 * @pattern "Same Data, Sales Lens" — uses existing units data with commercial filtering
 * @enterprise Salesforce Property Cloud, Yardi pattern
 */

import { useMemo, useState, useCallback } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Unit, CommercialStatus } from '@/types/unit';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface SalesFilterState {
  searchTerm: string;
  commercialStatus: CommercialStatus | 'all';
  unitType: string;
  building: string;
  floor: string;
  priceRange: { min: number | null; max: number | null };
  areaRange: { min: number | null; max: number | null };
}

export interface SalesDashboardStats {
  availableCount: number;
  averagePrice: number;
  totalValue: number;
  averagePricePerSqm: number;
}

export type SalesViewMode = 'list' | 'grid';

const DEFAULT_FILTERS: SalesFilterState = {
  searchTerm: '',
  commercialStatus: 'all',
  unitType: 'all',
  building: 'all',
  floor: 'all',
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 COMMERCIAL STATUS HELPERS
// =============================================================================

/** Status values that are explicitly hidden from the sales page */
const SALES_HIDDEN_STATUSES: CommercialStatus[] = [
  'sold',
  'rented',
];

/**
 * Units visible in "Διαθέσιμες Μονάδες":
 * - Units with commercialStatus: for-sale, for-sale-and-rent, reserved, unavailable
 * - Units WITHOUT commercialStatus (not yet classified → treat as available)
 * - Excludes: sold, rented
 */
function isVisibleInSales(unit: Unit): boolean {
  const status = unit.commercialStatus;
  if (!status) return true; // No commercial status → show (not yet classified)
  return !SALES_HIDDEN_STATUSES.includes(status);
}

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesUnitsViewerState() {
  // Data from SharedPropertiesProvider — SAME data source as /units page
  const { properties: allUnits, isLoading: loading, forceDataRefresh: refetch } = useSharedProperties();

  // View state
  const [viewMode, setViewMode] = useState<SalesViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SalesFilterState>(DEFAULT_FILTERS);

  // Quick filters (dual row)
  const [selectedCommercialStatus, setSelectedCommercialStatus] = useState<string>('all');
  const [selectedUnitType, setSelectedUnitType] = useState<string>('all');

  // =========================================================================
  // FILTER: Only units that are on the sales market
  // =========================================================================
  const salesUnits = useMemo(() => {
    return (allUnits as Unit[]).filter(isVisibleInSales);
  }, [allUnits]);

  // =========================================================================
  // FILTER: Apply user filters + search + quick filters
  // =========================================================================
  const filteredUnits = useMemo(() => {
    let result = salesUnits;

    // Quick filter: commercial status
    if (selectedCommercialStatus !== 'all') {
      result = result.filter(u => u.commercialStatus === selectedCommercialStatus);
    }

    // Quick filter: unit type
    if (selectedUnitType !== 'all') {
      result = result.filter(u => u.type === selectedUnitType);
    }

    // Advanced filter: commercial status (from AdvancedFiltersPanel)
    if (filters.commercialStatus !== 'all') {
      result = result.filter(u => u.commercialStatus === filters.commercialStatus);
    }

    // Advanced filter: unit type
    if (filters.unitType !== 'all') {
      result = result.filter(u => u.type === filters.unitType);
    }

    // Advanced filter: building
    if (filters.building !== 'all') {
      result = result.filter(u => u.buildingId === filters.building);
    }

    // Advanced filter: floor
    if (filters.floor !== 'all') {
      result = result.filter(u => u.floor === Number(filters.floor));
    }

    // Advanced filter: price range
    if (filters.priceRange.min !== null) {
      result = result.filter(u => (u.commercial?.askingPrice ?? 0) >= (filters.priceRange.min ?? 0));
    }
    if (filters.priceRange.max !== null) {
      result = result.filter(u => (u.commercial?.askingPrice ?? 0) <= (filters.priceRange.max ?? Infinity));
    }

    // Advanced filter: area range
    if (filters.areaRange.min !== null) {
      result = result.filter(u => (u.areas?.gross ?? u.area ?? 0) >= (filters.areaRange.min ?? 0));
    }
    if (filters.areaRange.max !== null) {
      result = result.filter(u => (u.areas?.gross ?? u.area ?? 0) <= (filters.areaRange.max ?? Infinity));
    }

    // Search (code, name, type, buyer)
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(u =>
        u.code?.toLowerCase().includes(term) ||
        u.name?.toLowerCase().includes(term) ||
        u.type?.toLowerCase().includes(term) ||
        u.building?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [salesUnits, filters, selectedCommercialStatus, selectedUnitType]);

  // =========================================================================
  // DASHBOARD STATS (computed from salesUnits — not filtered)
  // =========================================================================
  const dashboardStats = useMemo<SalesDashboardStats>(() => {
    const forSaleUnits = salesUnits.filter(u =>
      u.commercialStatus === 'for-sale' || u.commercialStatus === 'for-sale-and-rent'
    );

    const prices = forSaleUnits
      .map(u => u.commercial?.askingPrice)
      .filter((p): p is number => p !== null && p !== undefined && p > 0);

    const areas = forSaleUnits
      .map(u => u.areas?.gross ?? u.area ?? 0)
      .filter(a => a > 0);

    const totalPrice = prices.reduce((sum, p) => sum + p, 0);
    const totalArea = areas.reduce((sum, a) => sum + a, 0);

    return {
      availableCount: forSaleUnits.length,
      averagePrice: prices.length > 0 ? totalPrice / prices.length : 0,
      totalValue: totalPrice,
      averagePricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0,
    };
  }, [salesUnits]);

  // =========================================================================
  // SELECTION
  // =========================================================================
  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return filteredUnits.find(u => u.id === selectedUnitId) ?? null;
  }, [selectedUnitId, filteredUnits]);

  const handleSelectUnit = useCallback((unitId: string) => {
    setSelectedUnitId(prev => prev === unitId ? null : unitId);
  }, []);

  // =========================================================================
  // FILTER HANDLERS
  // =========================================================================
  const handleFiltersChange = useCallback((newFilters: Partial<SalesFilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectedCommercialStatus('all');
    setSelectedUnitType('all');
  }, []);

  return {
    // Data
    salesUnits,
    filteredUnits,
    loading,
    refetch,

    // View state
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,

    // Selection
    selectedUnit,
    selectedUnitId,
    handleSelectUnit,

    // Filters
    filters,
    handleFiltersChange,
    clearAllFilters,

    // Quick filters (dual row)
    selectedCommercialStatus,
    setSelectedCommercialStatus,
    selectedUnitType,
    setSelectedUnitType,

    // Dashboard
    dashboardStats,
  };
}
