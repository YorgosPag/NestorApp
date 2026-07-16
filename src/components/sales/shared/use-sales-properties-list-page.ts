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
import type { UnitFilterState } from '@/components/core/AdvancedFilters';
import type { Property } from '@/types/property';

export function useSalesPropertiesListPage(options?: UseSalesPropertiesViewerStateOptions) {
  const state = useSalesPropertiesViewerState(options);
  const { handleFiltersChange } = state;

  /** Τα φίλτρα του panel (πολλαπλή επιλογή) → η κατάσταση της σελίδας (μονή τιμή). */
  const onAdvancedFiltersChange = React.useCallback(
    (unitFilters: UnitFilterState) => {
      handleFiltersChange({
        searchTerm: unitFilters.searchTerm || '',
        building: unitFilters.building?.[0] || 'all',
        floor: unitFilters.floor?.[0] || 'all',
        propertyType: unitFilters.type?.[0] || 'all',
        areaRange: {
          min: unitFilters.areaRange?.min ?? null,
          max: unitFilters.areaRange?.max ?? null,
        },
      });
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

  return { state, onAdvancedFiltersChange, sidebarProps };
}
