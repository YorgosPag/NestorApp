'use client';

/**
 * @fileoverview Sales Storage Viewer State Hook — ADR-199
 * @description State management for "Διαθέσιμες Αποθήκες" sales page
 * @pattern Mirrors useSalesUnitsViewerState with storage-specific data
 */

import { useMemo, useState, useCallback } from 'react';
import { useFirestoreStorages } from '@/hooks/useFirestoreStorages';
import type { Storage } from '@/types/storage/contracts';
import type {
  SalesSpaceFilterState,
  SalesSpaceDashboardStats,
  SalesViewMode,
} from '@/types/sales-shared';

// =============================================================================
// 🏢 DEFAULTS
// =============================================================================

const DEFAULT_FILTERS: SalesSpaceFilterState = {
  searchTerm: '',
  status: 'all',
  type: 'all',
  building: 'all',
  floor: 'all',
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
};

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesStorageViewerState() {
  const { storages: allStorages, loading, refetch } = useFirestoreStorages();

  // View state
  const [viewMode, setViewMode] = useState<SalesViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SalesSpaceFilterState>(DEFAULT_FILTERS);

  // Quick filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // =========================================================================
  // FILTER: Apply user filters + search + quick filters
  // =========================================================================
  const filteredItems = useMemo(() => {
    let result = allStorages;

    // Quick filter: status
    if (selectedStatus !== 'all') {
      result = result.filter(s => s.status === selectedStatus);
    }

    // Quick filter: type
    if (selectedType !== 'all') {
      result = result.filter(s => s.type === selectedType);
    }

    // Advanced filter: status
    if (filters.status !== 'all') {
      result = result.filter(s => s.status === filters.status);
    }

    // Advanced filter: type
    if (filters.type !== 'all') {
      result = result.filter(s => s.type === filters.type);
    }

    // Advanced filter: building
    if (filters.building !== 'all') {
      result = result.filter(s => s.buildingId === filters.building || s.building === filters.building);
    }

    // Advanced filter: floor
    if (filters.floor !== 'all') {
      result = result.filter(s => s.floor === filters.floor);
    }

    // Advanced filter: price range
    if (filters.priceRange.min !== null) {
      result = result.filter(s => (s.commercial?.askingPrice ?? s.price ?? 0) >= (filters.priceRange.min ?? 0));
    }
    if (filters.priceRange.max !== null) {
      result = result.filter(s => (s.commercial?.askingPrice ?? s.price ?? 0) <= (filters.priceRange.max ?? Infinity));
    }

    // Advanced filter: area range
    if (filters.areaRange.min !== null) {
      result = result.filter(s => (s.area ?? 0) >= (filters.areaRange.min ?? 0));
    }
    if (filters.areaRange.max !== null) {
      result = result.filter(s => (s.area ?? 0) <= (filters.areaRange.max ?? Infinity));
    }

    // Search
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(term) ||
        s.building?.toLowerCase().includes(term) ||
        s.type?.toLowerCase().includes(term) ||
        s.floor?.toLowerCase().includes(term) ||
        s.description?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [allStorages, filters, selectedStatus, selectedType]);

  // =========================================================================
  // DASHBOARD STATS
  // =========================================================================
  const dashboardStats = useMemo<SalesSpaceDashboardStats>(() => {
    const availableItems = allStorages.filter(s => s.status === 'available');
    const prices = availableItems
      .map(s => s.commercial?.askingPrice ?? s.price ?? 0)
      .filter(p => p > 0);
    const areas = availableItems
      .map(s => s.area ?? 0)
      .filter(a => a > 0);

    const totalPrice = prices.reduce((sum, p) => sum + p, 0);
    const totalArea = areas.reduce((sum, a) => sum + a, 0);

    return {
      availableCount: availableItems.length,
      averagePrice: prices.length > 0 ? totalPrice / prices.length : 0,
      totalValue: totalPrice,
      averagePricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0,
    };
  }, [allStorages]);

  // =========================================================================
  // SELECTION
  // =========================================================================
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredItems.find(s => s.id === selectedItemId) ?? null;
  }, [selectedItemId, filteredItems]);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(prev => prev === itemId ? null : itemId);
  }, []);

  // =========================================================================
  // FILTER HANDLERS
  // =========================================================================
  const handleFiltersChange = useCallback((newFilters: Partial<SalesSpaceFilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectedStatus('all');
    setSelectedType('all');
  }, []);

  return {
    allItems: allStorages,
    filteredItems,
    loading,
    refetch,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    showFilters,
    setShowFilters,
    selectedItem,
    selectedItemId,
    handleSelectItem,
    filters,
    handleFiltersChange,
    clearAllFilters,
    selectedStatus,
    setSelectedStatus,
    selectedType,
    setSelectedType,
    dashboardStats,
  };
}
