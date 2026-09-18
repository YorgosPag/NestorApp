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
import { isDisplayableInSalesDashboard, requiresAskingPrice } from '@/constants/commercial-statuses';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import { EMPTY_PRICE_RANGE, isPriceRangeActive, matchesPriceRange, type RolePriceRange } from '@/lib/properties/price-range';
import { totalPriceByRole } from '@/lib/properties/price-totals';
import type { SalesDashboardStats } from '@/types/sales-shared';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface SalesFilterState {
  searchTerm: string;
  commercialStatus: CommercialStatus | 'all';
  propertyType: string;
  building: string;
  floor: string;
  /** Εύρος τιμής **με μονάδα** (ADR-777 §8.60.14.14). */
  priceRange: RolePriceRange;
  areaRange: { min: number | null; max: number | null };
}


export type SalesViewMode = 'list' | 'grid';

/** Ό,τι χρειάζεται το άθροισμα: η τιμή (για τον επιλυτή) και το εμβαδόν (για το €/m²). */
type SalesPricedUnit = PricedPropertyLike & Pick<Property, 'area' | 'areas'>;

/**
 * **Η όψη ΕΣΟΔΩΝ ενός πωλημένου ακινήτου: μόνο η τιμή συμβολαίου.**
 *
 * Ο επιλυτής, για `sold` χωρίς `finalPrice`, πέφτει στη ζητούμενη — σωστό για να
 * **δείξει** μια τιμή, λάθος για να την **αθροίσει ως έσοδο** (ADR-777 §8.2 #4: η
 * ζητούμενη δεν πληρώθηκε ποτέ). Κρατώντας μόνο το `finalPrice`, ένα πωλημένο χωρίς
 * καταγεγραμμένο συμβόλαιο πάει στην κλάση `'unpriced'` — **ονομάζεται**, αντί να
 * εξαφανίζεται σιωπηλά από το άθροισμα όπως πριν.
 */
function contractPriceView(unit: Property): SalesPricedUnit {
  return {
    commercialStatus: 'sold',
    commercial: { finalPrice: unit.commercial?.finalPrice ?? null },
    area: unit.area,
    areas: unit.areas,
  };
}

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
  priceRange: EMPTY_PRICE_RANGE,
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
      const rentPrice = unit.commercial?.rentPrice;
      const finalPrice = unit.commercial?.finalPrice;
      const grossArea = unit.areas?.gross ?? unit.area;

      if (viewScope === 'sold') {
        if (unit.commercialStatus !== 'sold') return false;
        return typeof finalPrice === 'number' && finalPrice > 0 &&
               typeof grossArea === 'number' && grossArea > 0;
      }

      // viewScope === 'available'
      // ADR-777 §8.2 #1: το gate ζητά askingPrice ΚΑΙ/Ή rentPrice ανάλογα με
      // την κατάσταση — μια ενοικίαση δεν έχει τιμή πώλησης να δώσει.
      if (isDisplayableInSalesDashboard({
        commercialStatus: unit.commercialStatus,
        askingPrice,
        rentPrice,
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

    // Advanced filter: price range — ADR-777 Α6 + §8.60.14.14: the range carries its UNIT;
    // only an amount in that role is judged, and a unit with none drops out (SQL rule).
    if (isPriceRangeActive(filters.priceRange)) {
      result = result.filter((u) => matchesPriceRange(u, filters.priceRange));
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
  // DASHBOARD STATS — ADR-777 §8.60.14.13: ο ΕΝΑΣ δρόμος (`totalPriceByRole`).
  // Εδώ ζούσε το χειρόγραφο `prices.reduce(...)` που ΔΕΝ περνούσε καν από τον
  // επιλυτή, και ένα €/m² που διαιρούσε το άθροισμα των τιμολογημένων με το
  // εμβαδόν ΟΛΩΝ. Οι δύο προβολές διαφέρουν μόνο στο ΤΙ ρωτούν:
  //   - `'available'` → η τιμή των προς πώληση (ο επιλυτής λέει τον ρόλο)
  //   - `'sold'`      → τα ΕΣΟΔΑ: μόνο η τιμή συμβολαίου (`contractPriceView`)
  // =========================================================================
  const dashboardStats = useMemo<SalesDashboardStats>(() => {
    const units: readonly SalesPricedUnit[] = viewScope === 'sold'
      ? salesUnits.map(contractPriceView)
      : salesUnits.filter(u => requiresAskingPrice(u.commercialStatus));
    return {
      availableCount: units.length,
      priceTotals: totalPriceByRole(units, u => u.areas?.gross ?? u.area),
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
