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
import { matchesPriceRange } from '@/lib/properties/price-range';
import { totalPriceByRole } from '@/lib/properties/price-totals';
import { matchesSpaceAvailability } from '@/lib/spaces/space-availability';
import type {
  SalesSpaceFilterState,
  SalesDashboardStats,
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

function matchesBuilding(item: SalesSpaceItem, building: string): boolean {
  // `building` is the deprecated name-based key (Storage only). Matching both
  // keeps legacy records filterable; spaces without it simply never match on it.
  return item.buildingId === building || item.building === building;
}

/**
 * Range predicate with SQL comparison semantics for a missing value.
 *
 * An inactive range passes everything. An ACTIVE range compared against `null`
 * is unknown, not true — so the item drops out, exactly as `WHERE price >= x`
 * drops a NULL row. The previous code substituted `0`, which let every
 * priceless unit through any filter with a lower bound of zero.
 */
function matchesRange(
  value: number | null,
  range: { min: number | null; max: number | null }
): boolean {
  if (range.min === null && range.max === null) return true;
  if (value === null) return false;
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
    // ADR-777 §8.60.20 — «διάθεση» από το `commercialStatus` (κουβάδες του ΕΝΟΣ SSoT), όχι το παλιό `status`.
    if (!matchesSpaceAvailability(item, quick.status)) return false;
    if (quick.type !== 'all' && item.type !== quick.type) return false;

    if (!matchesSpaceAvailability(item, filters.status)) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.building !== 'all' && !matchesBuilding(item, filters.building)) return false;
    if (filters.floor !== 'all' && item.floor !== filters.floor) return false;

    // ADR-777 §8.60.14.14 — ποσό ΣΤΗ ΜΟΝΑΔΑ του εύρους, ποτέ η κύρια τιμή όποιου ρόλου.
    if (!matchesPriceRange(item, filters.priceRange)) return false;
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

function computeDashboardStats(items: SalesSpaceItem[]): SalesDashboardStats {
  // ADR-777 §8.60.20 — «διαθέσιμες» = στην αγορά (κουβάς `listed` του `commercialStatus`).
  const available = items.filter((item) => matchesSpaceAvailability(item, 'listed'));

  // ADR-777 Α5/Α6 + §8.60.14.13 — per role, and the €/m² divides by the area of the
  // SAME units it summed: it used to divide the priced total by the area of ALL
  // available units, so every priceless spot pulled the €/m² down as if it were free.
  return {
    availableCount: available.length,
    priceTotals: totalPriceByRole(available, (item) => item.area),
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
