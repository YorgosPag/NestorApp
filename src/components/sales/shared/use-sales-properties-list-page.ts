'use client';

/**
 * =============================================================================
 * useSalesPropertiesListPage — SSoT controller για τις σελίδες ακινήτων πωλήσεων
 * =============================================================================
 *
 * «Διαθέσιμα» και «Πωλημένα» δεν είναι δύο σελίδες με κοινή εμφάνιση: είναι η
 * ΙΔΙΑ σελίδα με άλλο `viewScope`. Τρέχουν στο ίδιο `useSalesPropertiesViewerState`,
 * αντιστοιχίζουν τα ίδια φίλτρα και ταΐζουν το ίδιο `SalesSidebar` — γι' αυτό η
 * αντιστοίχιση ζει εδώ μία φορά (jscpd: 33+18 διπλές γραμμές πριν το ADR-584).
 *
 * 🔑 ADR-840 §7.9 — **οι επιλογές των φίλτρων ζουν ΕΔΩ, μία φορά**: ο ΕΝΑΣ εγχυτής
 * (`usePropertyFiltersConfig`) πάνω στα ακίνητα της προβολής. Ως τις 2026-10-19 οι δύο σελίδες
 * περνούσαν τη **στατική** σταθερά ⇒ Έργο/Κτίριο/Όροφος/Τύπος έδειχναν ΜΟΝΟ «Όλα».
 *
 * Ό,τι διαφέρει πραγματικά (τίτλοι, στατιστικά, κάρτα, ετικέτες sidebar) μένει
 * στη σελίδα — δηλωτικά, ΟΧΙ με `if (scope === 'sold')` εδώ μέσα.
 *
 * @module components/sales/shared/use-sales-properties-list-page
 * @see @/hooks/useSalesPropertiesViewerState — η κατάσταση (ADR-197)
 * @see sales-list-page-shell.tsx — ο κοινός σκελετός
 */

import React from 'react';
import {
  useSalesPropertiesViewerState,
  type UseSalesPropertiesViewerStateOptions,
} from '@/hooks/useSalesPropertiesViewerState';
import { propertyListFiltersConfig, type UnitFilterState } from '@/components/core/AdvancedFilters';
import { usePropertyFiltersConfig } from '@/components/core/AdvancedFilters/hooks/usePropertyFiltersConfig';
import type { SalesFilterState } from '@/hooks/useSalesPropertiesViewerState';
import type { Property } from '@/types/property';

/** Μονή τιμή της κατάστασης → πίνακας του panel (`'all'` = κενός). */
function asList(value: string): string[] {
  return value === 'all' ? [] : [value];
}

/** Η κατάσταση της σελίδας → οι τιμές που δείχνει το panel. Ρητή αντιστοίχιση, όχι cast. */
export function toPanelFilters(filters: SalesFilterState): UnitFilterState {
  return {
    searchTerm: filters.searchTerm,
    project: filters.project,
    building: filters.building,
    floor: filters.floor,
    type: asList(filters.propertyType),
    status: filters.status,
    priceRange: filters.priceRange,
    areaRange: filters.areaRange,
    features: [],
  };
}

/** Τα φίλτρα του panel → η κατάσταση της σελίδας. Οι ταυτότητες θέσης περνούν αυτούσιες (πίνακες). */
export function fromPanelFilters(unitFilters: UnitFilterState): Partial<SalesFilterState> {
  return {
    searchTerm: unitFilters.searchTerm || '',
    project: unitFilters.project ?? [],
    building: unitFilters.building ?? [],
    floor: unitFilters.floor ?? [],
    status: unitFilters.status ?? [],
    propertyType: unitFilters.type?.[0] || 'all',
    areaRange: {
      min: unitFilters.areaRange?.min ?? null,
      max: unitFilters.areaRange?.max ?? null,
    },
  };
}

export function useSalesPropertiesListPage(options?: UseSalesPropertiesViewerStateOptions) {
  const state = useSalesPropertiesViewerState(options);
  const { handleFiltersChange, filters } = state;

  // ADR-840 §7.9 — ο ΕΝΑΣ εγχυτής, πάνω στα ακίνητα ΤΗΣ ΠΡΟΒΟΛΗΣ (όχι του φίλτρου: οι επιλογές δεν
  // εξαφανίζονται όταν διαλέγεις μία), με καταρράκτη από την τρέχουσα επιλογή έργου/κτιρίου.
  const filtersConfig = usePropertyFiltersConfig(state.salesUnits, propertyListFiltersConfig, filters);
  const panelFilters = React.useMemo(() => toPanelFilters(filters), [filters]);

  /** Τα φίλτρα του panel (πολλαπλή επιλογή) → η κατάσταση της σελίδας (μονή τιμή). */
  const onAdvancedFiltersChange = React.useCallback(
    (unitFilters: UnitFilterState) => {
      handleFiltersChange(fromPanelFilters(unitFilters));
    },
    [handleFiltersChange]
  );

  /** Κατάσταση → props του `SalesSidebar`. Οι ετικέτες μπαίνουν από τη σελίδα. */
  const sidebarProps = {
    units: state.filteredUnits as Property[],
    selectedProperty: state.selectedProperty as Property | null,
    onSelectProperty: state.handleSelectProperty,
    selectedPropertyId: state.selectedPropertyId,
    selectedCommercialStatus: state.selectedCommercialStatus,
    onCommercialStatusChange: state.setSelectedCommercialStatus,
    selectedPropertyType: state.selectedPropertyType,
    onPropertyTypeChange: state.setSelectedPropertyType,
    onDataMutated: state.refetch,
  };

  return { state, filtersConfig, panelFilters, onAdvancedFiltersChange, sidebarProps };
}
