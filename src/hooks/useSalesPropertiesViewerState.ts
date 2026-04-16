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

export function useSalesPropertiesViewerState() {
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
  // DISPLAY-ELIGIBLE UNITS — Gate via SSoT `isDisplayableInSalesDashboard`.
  // Listed commercial status + askingPrice > 0 + grossArea > 0. Coerent με το
  // UX contract του SalesDashboardRequirementsAlert (ADR-287 Batch 18).
  //
  // Αποκλείονται: unavailable, reserved, sold, rented + incomplete listings.
  // Sold/rented units παραμένουν διαθέσιμα μέσω reports/analytics pages —
  // όχι σε αυτήν την "Διαθέσιμα Ακίνητα" vetrina (το όνομα της σελίδας
  // υπαγορεύει scope).
  // =========================================================================
  const salesUnits = useMemo(() => {
    return (allUnits as Property[]).filter(unit =>
      isDisplayableInSalesDashboard({
        commercialStatus: unit.commercialStatus,
        askingPrice: unit.commercial?.askingPrice,
        grossArea: unit.areas?.gross ?? unit.area,
      }),
    );
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
  // DASHBOARD STATS (computed from salesUnits — not filtered)
  // =========================================================================
  const dashboardStats = useMemo<SalesDashboardStats>(() => {
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
  }, [salesUnits]);

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
