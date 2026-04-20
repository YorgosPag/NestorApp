'use client';

/**
 * @fileoverview Sales Units Viewer State Hook — ADR-197
 * @description State management for the "Διαθέσιμες Μονάδες" sales page
 * @pattern "Same Data, Sales Lens" — uses existing units data with commercial filtering
 * @enterprise Salesforce Property Cloud, Yardi pattern
 */

import { useMemo, useState, useCallback } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Property, CommercialStatus } from '@/types/property';
import { isDisplayableInSalesDashboard } from '@/constants/commercial-statuses';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface SalesFilterState {
  searchTerm: string;
  commercialStatus: CommercialStatus | 'all';
  propertyType: string;
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

/**
 * View scope for this hook — distinguishes the sales-pipeline page using the hook:
 * - `'available'` → properties actively on market (for-sale/for-sale-and-rent + reserved in-progress)
 * - `'sold'`      → properties with finalized sale (commercialStatus === 'sold' with finalPrice)
 */
export type SalesViewScope = 'available' | 'sold';

export interface UseSalesPropertiesViewerStateOptions {
  viewScope?: SalesViewScope;
}

const DEFAULT_FILTERS: SalesFilterState = {
  searchTerm: '',
  commercialStatus: 'all',
  propertyType: 'all',
  building: 'all',
  floor: 'all',
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesPropertiesViewerState(
  options: UseSalesPropertiesViewerStateOptions = {},
) {
  const { viewScope = 'available' } = options;

  // Data from SharedPropertiesProvider — SAME data source as /properties page
  const { properties: allUnits, isLoading: loading, forceDataRefresh: refetch } = useSharedProperties();

  // View state
  const [viewMode, setViewMode] = useState<SalesViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SalesFilterState>(DEFAULT_FILTERS);

  // Quick filters (dual row)
  const [selectedCommercialStatus, setSelectedCommercialStatus] = useState<string>('all');
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('all');

  // =========================================================================
  // DISPLAY-ELIGIBLE UNITS — Scope-aware filter.
  //
  // `'available'` scope (Διαθέσιμα Ακίνητα vetrina):
  //   - Listed status via SSoT `isDisplayableInSalesDashboard`
  //     (for-sale / for-rent / for-sale-and-rent + askingPrice>0 + grossArea>0)
  //   - + `reserved` in-progress sales (so the agent can complete or revert)
  //   - Sold/rented units are NOT shown here — they live in their own pages
  //     (/sales/sold, /sales/rented).
  //
  // `'sold'` scope (Πωληθέντα Ακίνητα):
  //   - Only `commercialStatus === 'sold'` with `finalPrice > 0` and `grossArea > 0`.
  //   - Sold units remain actionable (piano αποπληρωμής, legal docs) until the
  //     full post-sale workflow is complete.
  // =========================================================================
  const salesUnits = useMemo(() => {
    return (allUnits as Property[]).filter(unit => {
      const askingPrice = unit.commercial?.askingPrice;
      const finalPrice = unit.commercial?.finalPrice;
      const grossArea = unit.areas?.gross ?? unit.area;

      if (viewScope === 'sold') {
        if (unit.commercialStatus !== 'sold') return false;
        return typeof finalPrice === 'number' && finalPrice > 0 &&
               typeof grossArea === 'number' && grossArea > 0;
      }

      // viewScope === 'available'
      if (isDisplayableInSalesDashboard({
        commercialStatus: unit.commercialStatus,
        askingPrice,
        grossArea,
      })) {
        return true;
      }

      // Reserved units are in-progress sales — include so they can be completed or reverted.
      if (unit.commercialStatus === 'reserved') {
        return typeof askingPrice === 'number' && askingPrice > 0 &&
               typeof grossArea === 'number' && grossArea > 0;
      }

      return false;
    });
  }, [allUnits, viewScope]);

  // =========================================================================
  // FILTER: Apply user filters + search + quick filters
  // =========================================================================
  const filteredUnits = useMemo(() => {
    let result = salesUnits;

    // Quick filter: commercial status
    if (selectedCommercialStatus !== 'all') {
      result = result.filter(u => u.commercialStatus === selectedCommercialStatus);
    }

    // Quick filter: property type
    if (selectedPropertyType !== 'all') {
      result = result.filter(u => u.type === selectedPropertyType);
    }

    // Advanced filter: commercial status (from AdvancedFiltersPanel)
    if (filters.commercialStatus !== 'all') {
      result = result.filter(u => u.commercialStatus === filters.commercialStatus);
    }

    // Advanced filter: property type
    if (filters.propertyType !== 'all') {
      result = result.filter(u => u.type === filters.propertyType);
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
  }, [salesUnits, filters, selectedCommercialStatus, selectedPropertyType]);

  // =========================================================================
  // DASHBOARD STATS — scope-aware aggregations.
  // Shape (count / averagePrice / totalValue / averagePricePerSqm) is shared
  // between scopes; semantics differ:
  //   - `'available'` uses `askingPrice` on for-sale/dual listings
  //   - `'sold'`      uses `finalPrice` on sold units (contract price)
  // =========================================================================
  const dashboardStats = useMemo<SalesDashboardStats>(() => {
    if (viewScope === 'sold') {
      const finalPrices = salesUnits
        .map(u => u.commercial?.finalPrice)
        .filter((p): p is number => typeof p === 'number' && p > 0);

      const areas = salesUnits
        .map(u => u.areas?.gross ?? u.area ?? 0)
        .filter(a => a > 0);

      const totalRevenue = finalPrices.reduce((sum, p) => sum + p, 0);
      const totalArea = areas.reduce((sum, a) => sum + a, 0);

      return {
        availableCount: salesUnits.length,
        averagePrice: finalPrices.length > 0 ? totalRevenue / finalPrices.length : 0,
        totalValue: totalRevenue,
        averagePricePerSqm: totalArea > 0 ? totalRevenue / totalArea : 0,
      };
    }

    // viewScope === 'available'
    const forSaleProperties = salesUnits.filter(u =>
      u.commercialStatus === 'for-sale' || u.commercialStatus === 'for-sale-and-rent'
    );

    const prices = forSaleProperties
      .map(u => u.commercial?.askingPrice)
      .filter((p): p is number => p !== null && p !== undefined && p > 0);

    const areas = forSaleProperties
      .map(u => u.areas?.gross ?? u.area ?? 0)
      .filter(a => a > 0);

    const totalPrice = prices.reduce((sum, p) => sum + p, 0);
    const totalArea = areas.reduce((sum, a) => sum + a, 0);

    return {
      availableCount: forSaleProperties.length,
      averagePrice: prices.length > 0 ? totalPrice / prices.length : 0,
      totalValue: totalPrice,
      averagePricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0,
    };
  }, [salesUnits, viewScope]);

  // =========================================================================
  // SELECTION
  // =========================================================================
  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    return filteredUnits.find(u => u.id === selectedPropertyId) ?? null;
  }, [selectedPropertyId, filteredUnits]);

  const handleSelectProperty = useCallback((propertyId: string) => {
    setSelectedPropertyId(prev => prev === propertyId ? null : propertyId);
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
    setSelectedPropertyType('all');
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
    selectedProperty,
    selectedPropertyId,
    handleSelectProperty,

    // Filters
    filters,
    handleFiltersChange,
    clearAllFilters,

    // Quick filters (dual row)
    selectedCommercialStatus,
    setSelectedCommercialStatus,
    selectedPropertyType,
    setSelectedPropertyType,

    // Dashboard
    dashboardStats,
  };
}
