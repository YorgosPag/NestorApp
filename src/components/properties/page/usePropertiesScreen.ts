'use client';

/**
 * 🧩 Η ΣΥΝΘΕΣΗ της ενιαίας οθόνης ακινήτων (ADR-840 Σ3) — ο ΕΝΑΣ κάτοχος, όλα από μία μηχανή.
 *
 * | Τι | Από πού | Γιατί εκεί |
 * |---|---|---|
 * | ακίνητα · επεξεργασία · διάλογοι | `usePropertiesViewerState` | η ΜΙΑ μηχανή (ήταν δύο: + `usePublicPropertyViewer`) |
 * | φίλτρα | η διεύθυνση (`usePropertyFiltersUrlState`, μέσα στη μηχανή) | refresh · «πίσω» · σύνδεσμος (§7.7) |
 * | όψη · επιλογή | η διεύθυνση (`usePropertiesView` · `?selected=`) | ίδια επιλογή σε κάθε φακό |
 * | κάδος · αρχείο | `usePropertyRetiredViews` | πράξεις μόνο με `:delete` (Α5) |
 * | δημιουργία | `usePropertyCreation` | `?new=1` από την καρτέλα |
 *
 * ⛔ ΜΗΝ προσθέσεις εδώ `useState` φίλτρων ή όψης — δεύτερο αντίγραφο είναι ακριβώς η βλάβη του §7.7.
 */

import { useCallback, useMemo, useState } from 'react';

import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';
import { propertyFiltersConfig } from '@/components/core/AdvancedFilters';
import { usePropertyFiltersConfig } from '@/components/core/AdvancedFilters/hooks/usePropertyFiltersConfig';
import { usePropertyRetiredViews } from '@/components/properties/page/usePropertyRetiredViews';
import { resolveViewedProperty } from '@/hooks/property-viewer-selection';
import { usePropertiesView } from '@/hooks/usePropertiesView';
import { usePropertiesViewerState } from '@/hooks/usePropertiesViewerState';
import { usePropertyDeleteCapability } from '@/hooks/usePropertyEditCapability';
import type { FilterState } from '@/types/property-viewer';
import { usePropertyCreation } from './usePropertyCreation';

/** Το ακίνητο του πλαισίου, λυμένο πάνω στη λίστα της ΕΝΕΡΓΗΣ προβολής (κάδος/αρχείο ⇒ οι αποσυρμένες γραμμές). */
function useViewedProperty(
  engine: ReturnType<typeof usePropertiesViewerState>,
  retiredRows: ReturnType<typeof usePropertyRetiredViews>['retiredView'],
) {
  const { selectedProperty, selectedPropertyIds } = engine;
  // ADR-329 §3.9 — η ζωντανή λίστα δεν περιέχει αποσυρμένα (`SharedPropertiesProvider`): σε κάδο/αρχείο το πλαίσιο
  // λύνεται πάνω στις δικές τους γραμμές, αλλιώς θα έμενε άδειο.
  return useMemo(
    () => (retiredRows
      ? resolveViewedProperty({ properties: retiredRows.properties, explicitPropertyId: undefined, selectedPropertyIds, contactIds: [] })
      : selectedProperty),
    [retiredRows, selectedPropertyIds, selectedProperty],
  );
}

export function usePropertiesScreen() {
  const engine = usePropertiesViewerState();
  const { view, setView } = usePropertiesView();
  const { canDelete } = usePropertyDeleteCapability();
  const [showFilters, setShowFilters] = useState(false);

  const creation = usePropertyCreation({ selectProperty: engine.handlePolygonSelect, refresh: engine.forceDataRefresh });

  const retired = usePropertyRetiredViews({
    selectedPropertyIds: engine.selectedPropertyIds,
    setSelectedProperties: engine.setSelectedProperties,
    forceDataRefresh: engine.forceDataRefresh,
    // Από την ΕΠΙΛΟΓΗ, όχι από το ακίνητο του πλαισίου: εκείνο λύνεται πάνω στη λίστα που δίνει αυτό το hook.
    activePropertyId: engine.selectedPropertyIds.length === 1 ? engine.selectedPropertyIds[0] : null,
    activePropertyCount: engine.properties.length,
    canDelete,
  });

  const viewedProperty = useViewedProperty(engine, retired.retiredView);
  useBreadcrumbSync(viewedProperty ? { type: 'property', id: viewedProperty.id, name: viewedProperty.name } : null);

  const filtersConfig = usePropertyFiltersConfig(engine.properties, propertyFiltersConfig, engine.filters);
  const updateFilters = engine.handleFiltersChange;
  const setSearchTerm = useCallback((searchTerm: string) => updateFilters({ searchTerm }), [updateFilters]);
  const onFiltersChange = useCallback((next: FilterState) => updateFilters(next), [updateFilters]);

  // «Δες το στην κάτοψη» από κάρτα — αλλαγή ΟΨΗΣ με το ακίνητο επιλεγμένο (replace, ίδια φίλτρα).
  const viewOnFloorplan = useCallback((propertyId: string) => setView('floorplan', propertyId), [setView]);

  return {
    engine, view, setView, canDelete, creation, retired, viewedProperty,
    showFilters, setShowFilters, filtersConfig, updateFilters, onFiltersChange, setSearchTerm, viewOnFloorplan,
  };
}

export type PropertiesScreenState = ReturnType<typeof usePropertiesScreen>;
