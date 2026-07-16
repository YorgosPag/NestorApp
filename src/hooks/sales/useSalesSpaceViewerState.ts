'use client';

/**
 * @fileoverview Sales Space Viewer State Hook — SSoT for auxiliary-space sales pages
 * @description Channel-agnostic view/filter/stats state shared by the "Διαθέσιμες
 *              Θέσεις Στάθμευσης" and "Διαθέσιμες Αποθήκες" sales pages.
 * @pattern Enterprise SSoT — per-space hooks supply data + the filters unique to them
 * @enterprise ADR-199 - Storage & Parking as sale appurtenances
 * @enterprise ADR-584 - jscpd clone ratchet (de-duplication of sales viewer hooks)
 */

import { useMemo, useState, useCallback } from 'react';
import type {
  SalesSpaceFilterState,
  SalesSpaceDashboardStats,
  SalesSpaceItem,
  SalesViewMode,
} from '@/types/sales-shared';

// =============================================================================
// 🏢 OPTIONS
// =============================================================================

export interface UseSalesSpaceViewerStateOptions<
  TItem extends SalesSpaceItem,
  TFilters extends SalesSpaceFilterState,
> {
  /** All spaces of this kind, already loaded. */
  items: TItem[];
  loading: boolean;
  refetch: () => void;
  /** Initial filter values — also what `clearAllFilters` restores. */
  defaultFilters: TFilters;
  /**
   * Does this item match the free-text search term? The searchable fields differ
   * per space (parking searches its number/location, storage its name/description),
   * so each caller owns this predicate. `term` is already lower-cased and trimmed.
   */
  matchesSearch: (item: TItem, term: string) => boolean;
  /**
   * Optional predicate for filters that exist on one space only — e.g. parking's
   * `locationZone`. Return true when the item passes.
   */
  matchesExtraFilters?: (item: TItem, filters: TFilters) => boolean;
}

// =============================================================================
// 🏢 FILTERING
// =============================================================================

/** Price actually used for sales: the commercial asking price, else the base price. */
function effectivePrice(item: SalesSpaceItem): number {
  return item.commercial?.askingPrice ?? item.price ?? 0;
}

function matchesBuilding(item: SalesSpaceItem, building: string): boolean {
  // `building` is the deprecated name-based key (Storage only). Matching both
  // keeps legacy records filterable; spaces without it simply never match on it.
  return item.buildingId === building || item.building === building;
}

function matchesRange(
  value: number,
  range: { min: number | null; max: number | null }
): boolean {
  if (range.min !== null && value < range.min) return false;
  if (range.max !== null && value > range.max) return false;
  return true;
}

function applyFilters<TItem extends SalesSpaceItem, TFilters extends SalesSpaceFilterState>(
  items: TItem[],
  filters: TFilters,
  quick: { status: string; type: string },
  options: Pick<
    UseSalesSpaceViewerStateOptions<TItem, TFilters>,
    'matchesSearch' | 'matchesExtraFilters'
  >
): TItem[] {
  const term = filters.searchTerm.trim().toLowerCase();

  return items.filter((item) => {
    if (quick.status !== 'all' && item.status !== quick.status) return false;
    if (quick.type !== 'all' && item.type !== quick.type) return false;

    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.building !== 'all' && !matchesBuilding(item, filters.building)) return false;
    if (filters.floor !== 'all' && item.floor !== filters.floor) return false;

    if (!matchesRange(effectivePrice(item), filters.priceRange)) return false;
    if (!matchesRange(item.area ?? 0, filters.areaRange)) return false;

    if (options.matchesExtraFilters && !options.matchesExtraFilters(item, filters)) {
      return false;
    }

    if (term && !options.matchesSearch(item, term)) return false;

    return true;
  });
}

// =============================================================================
// 🏢 STATS
// =============================================================================

function computeDashboardStats(items: SalesSpaceItem[]): SalesSpaceDashboardStats {
  const available = items.filter((item) => item.status === 'available');
  const prices = available.map(effectivePrice).filter((p) => p > 0);
  const areas = available.map((item) => item.area ?? 0).filter((a) => a > 0);

  const totalPrice = prices.reduce((sum, p) => sum + p, 0);
  const totalArea = areas.reduce((sum, a) => sum + a, 0);

  return {
    availableCount: available.length,
    averagePrice: prices.length > 0 ? totalPrice / prices.length : 0,
    totalValue: totalPrice,
    averagePricePerSqm: totalArea > 0 ? totalPrice / totalArea : 0,
  };
}

// =============================================================================
// 🏢 MAIN HOOK
// =============================================================================

export function useSalesSpaceViewerState<
  TItem extends SalesSpaceItem,
  TFilters extends SalesSpaceFilterState,
>(options: UseSalesSpaceViewerStateOptions<TItem, TFilters>) {
  const { items, loading, refetch, defaultFilters, matchesSearch, matchesExtraFilters } = options;

  // View state
  const [viewMode, setViewMode] = useState<SalesViewMode>('list');
  const [showDashboard, setShowDashboard] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TFilters>(defaultFilters);

  // Quick filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filteredItems = useMemo(
    () =>
      applyFilters(items, filters, { status: selectedStatus, type: selectedType }, {
        matchesSearch,
        matchesExtraFilters,
      }),
    [items, filters, selectedStatus, selectedType, matchesSearch, matchesExtraFilters]
  );

  const dashboardStats = useMemo(() => computeDashboardStats(items), [items]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredItems.find((item) => item.id === selectedItemId) ?? null;
  }, [selectedItemId, filteredItems]);

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const handleFiltersChange = useCallback((newFilters: Partial<TFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSelectedStatus('all');
    setSelectedType('all');
  }, [defaultFilters]);

  return {
    allItems: items,
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
