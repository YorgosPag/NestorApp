'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePropertyViewer } from '@/hooks/usePropertyViewer';
import { usePropertiesView } from '@/hooks/usePropertiesView';
import { usePropertySelectionUrlSync } from '@/hooks/usePropertySelectionUrlSync';
import { useAuth } from '@/hooks/useAuth';
import { ContactsService } from '@/services/contacts.service';
import { createModuleLogger } from '@/lib/telemetry';
import type { Connection } from '@/types/connections';
import type { FilterState, Property } from '@/types/property-viewer';
import { resolveViewedProperty } from './property-viewer-selection';

const logger = createModuleLogger('usePropertiesViewerState');

const noop = () => {};

/**
 * @param explicitPropertyId — **Ποιο ακίνητο είναι επιλεγμένο, όταν το ξέρει ο
 * καλών.** Η ενιαία οθόνη `/properties` το μαθαίνει από τη διεύθυνση
 * (`?selected=`, αμφίδρομα — `usePropertySelectionUrlSync`, ADR-840 Σ3)· η σελίδα
 * `/properties/[id]` το ξέρει από τη **διαδρομή** (ADR-777 §8.30).
 *
 * 🔑 **Παραμετροποιείται η ΠΗΓΗ της απάντησης, όχι η μηχανή.** Ένας δεύτερος
 * φορτωτής ακινήτου θα ήταν **δεύτερη μετάφραση** των ίδιων εγγράφων σε `Property`
 * — ακριβώς η αστοχία που το `place-interest.service` περιγράφει γραπτά: δύο
 * μεταφράσεις μπορούν να δείξουν **διαφορετικά πράγματα για το ίδιο ακίνητο**, και
 * **και οι δύο να φαίνονται σωστές**.
 *
 * ⚠️ Το ρητό όρισμα **νικά** τη διεύθυνση και δεν πέφτει πίσω σε αυτή: μια σελίδα
 * που ξέρει ταυτότητα από τη διαδρομή της δεν επιτρέπεται να αλλάξει θέμα επειδή
 * κάποιος κόλλησε `?selected=` — και **δεν γράφει** ποτέ στη διεύθυνση.
 */
export function usePropertiesViewerState(explicitPropertyId?: string | null) {
  const { selectedId: urlSelectedId } = usePropertiesView();
  const routeOwnsIdentity = explicitPropertyId !== undefined;

  const {
    properties,
    setProperties,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    setSelectedProperties,
    floors,
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    showMeasurements,
    setShowMeasurements,
    scale,
    setScale,
    showHistoryPanel,
    setShowHistoryPanel,
    showDashboard,
    setShowDashboard,
    suggestionToDisplay,
    setSuggestionToDisplay,
    connections,
    setConnections,
    groups,
    setGroups,
    isConnecting,
    setIsConnecting,
    firstConnectionPoint,
    setFirstConnectionPoint,
    filters,
    updateFilters,
    filteredProperties,
    stats,
    isLoading,
    hasAnswered,
    forceDataRefresh,
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handleUpdateProperty,
    checkingPropertyMutation,
    PropertyMutationImpactDialog,
    PropertyDeletionDialogs,
  } = usePropertyViewer();

  const [allContactIds, setAllContactIds] = useState<string[]>([]);
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    // Wait until Firebase auth resolves before querying Firestore — otherwise
    // `requireAuthContext()` throws AUTHENTICATION_ERROR on an unauthenticated
    // cold start, producing the "Failed to fetch contact IDs" error.
    if (authLoading || !authUser) return;

    let cancelled = false;
    async function fetchContactIds() {
      try {
        const ids = await ContactsService.getAllContactIds();
        if (!cancelled) setAllContactIds(ids);
      } catch (error) {
        // Extract message/stack eagerly — some thrown values are plain
        // objects without enumerable props, which would log as `{}`.
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : typeof error;
        logger.error('Failed to fetch contact IDs', {
          errorMessage,
          errorName,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    void fetchContactIds();
    return () => { cancelled = true; };
  }, [authLoading, authUser]);

  // Η ΔΙΑΔΡΟΜΗ ξέρει την ταυτότητα (`/properties/[id]`) ⇒ επιλέγεται αυτή, χωρίς καμία επαφή με τη διεύθυνση.
  useEffect(() => {
    if (!routeOwnsIdentity || !explicitPropertyId || properties.length === 0 || !setSelectedProperties) {
      return;
    }

    const property = properties.find((item) => item.id === explicitPropertyId);
    if (!property) {
      logger.warn('Property not found in properties', { propertyId: explicitPropertyId });
      return;
    }

    setSelectedProperties([explicitPropertyId]);
    if (property.floorId && onSelectFloor) {
      onSelectFloor(property.floorId);
    }
  }, [routeOwnsIdentity, explicitPropertyId, onSelectFloor, properties, setSelectedProperties]);

  // Η ενιαία οθόνη: η επιλογή ⇄ `?selected=` (ADR-840 Σ3) — «πίσω» από την καρτέλα επιστρέφει στο ίδιο ακίνητο.
  usePropertySelectionUrlSync({
    enabled: !routeOwnsIdentity,
    urlSelectedId,
    selectedIds: Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [],
    properties: Array.isArray(properties) ? properties : [],
    select: setSelectedProperties,
    onSelectFloor,
  });

  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];
  const safeFloors = Array.isArray(floors) ? floors : [];

  // 🔑 ADR-849 Β1 — ΠΑΡΑΓΕΤΑΙ στο ίδιο καρέ, δεν περιμένει το effect της επιλογής
  //    παραπάνω (που μένει για τις καρτέλες/κάτοψη). Δες `property-viewer-selection.ts`.
  const selectedProperty = useMemo(
    () =>
      resolveViewedProperty({
        properties: safeProperties,
        explicitPropertyId,
        selectedPropertyIds: Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [],
        contactIds: allContactIds,
      }),
    [allContactIds, safeProperties, selectedPropertyIds, explicitPropertyId],
  );

  const handleSelectProperty = (property: Property) => {
    if (setSelectedProperties) {
      setSelectedProperties([property.id]);
    }
  };

  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    if (!setSelectedProperties) {
      return;
    }

    if (propertyId === '__all__') {
      setSelectedProperties(safeFilteredProperties.map((property) => property.id));
      return;
    }

    if (propertyId === '__none__') {
      setSelectedProperties([]);
      return;
    }

    setSelectedProperties((previous: string[]) => {
      const safePrevious = Array.isArray(previous) ? previous : [];
      if (!propertyId) {
        return [];
      }

      if (isShiftClick) {
        return safePrevious.includes(propertyId)
          ? safePrevious.filter((id) => id !== propertyId)
          : [...safePrevious, propertyId];
      }

      return safePrevious.length === 1 && safePrevious[0] === propertyId ? [] : [propertyId];
    });

    if (isConnecting && !isShiftClick) {
      const property = safeProperties.find((item) => item.id === propertyId);
      if (!property) {
        return;
      }

      if (!firstConnectionPoint) {
        if (setFirstConnectionPoint) {
          setFirstConnectionPoint(property);
        }
        return;
      }

      if (firstConnectionPoint.id === property.id) {
        return;
      }

      if (setConnections) {
        setConnections((previous: Connection[]) => [
          ...(Array.isArray(previous) ? previous : []),
          {
            id: `conn_${firstConnectionPoint.id}_${property.id}`,
            from: firstConnectionPoint.id,
            to: property.id,
            type: 'related',
          },
        ]);
      }

      if (setFirstConnectionPoint) {
        setFirstConnectionPoint(null);
      }
      if (setIsConnecting) {
        setIsConnecting(false);
      }
    }
  };

  // ADR-840 Σ3 — ΕΝΑ ταμπλό, που μετρά ό,τι ΒΛΕΠΕΙΣ: τα στατιστικά της μηχανής, πάνω στο φιλτραρισμένο σύνολο.
  //    Εδώ ζούσε δεύτερος υπολογισμός (όλο το απόθεμα, αγνοώντας τα φίλτρα) + αντίγραφο της πληρότητας.
  const dashboardStats = stats;

  // Ο καταρράκτης (§7.6) και η γραφή `replace` ζουν στον `usePropertyFiltersUrlState`.
  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    updateFilters(newFilters);
  };

  return {
    properties: safeProperties,
    loading: isLoading,
    /**
     * ADR-777 §8.30 — **«απάντησε ο κατάλογος;»**, ξεχωριστό από το `loading`.
     *
     * Χωρίς αυτό, ο συνδυασμός `!loading && properties.length === 0` διαβάζεται
     * ως «δεν υπάρχει» ενώ σημαίνει «δεν ρώτησε κανείς **ακόμη**» — η τεμπέλικη
     * ενεργοποίηση του `SharedPropertiesProvider` το κάνει **βέβαιο** στο πρώτο
     * καρέ κάθε σελίδας.
     */
    hasAnswered: Boolean(hasAnswered),
    setProperties: setProperties || noop,
    selectedPropertyIds: Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [],
    hoveredPropertyId: hoveredPropertyId || null,
    selectedFloorId: selectedFloorId || null,
    onHoverProperty: onHoverProperty || noop,
    onSelectFloor: onSelectFloor || noop,
    undo: undo || noop,
    redo: redo || noop,
    canUndo: Boolean(canUndo),
    canRedo: Boolean(canRedo),
    setSelectedProperties: setSelectedProperties || noop,
    floors: safeFloors,
    activeTool: activeTool || null,
    setActiveTool: setActiveTool || noop,
    showGrid: Boolean(showGrid),
    setShowGrid: setShowGrid || noop,
    snapToGrid: Boolean(snapToGrid),
    setSnapToGrid: setSnapToGrid || noop,
    gridSize: Number(gridSize) || 20,
    setGridSize: setGridSize || noop,
    showMeasurements: Boolean(showMeasurements),
    setShowMeasurements: setShowMeasurements || noop,
    scale: Number(scale) || 1,
    setScale: setScale || noop,
    showHistoryPanel: Boolean(showHistoryPanel),
    setShowHistoryPanel: setShowHistoryPanel || noop,
    showDashboard: Boolean(showDashboard),
    setShowDashboard: setShowDashboard || noop,
    suggestionToDisplay: suggestionToDisplay || null,
    setSuggestionToDisplay: setSuggestionToDisplay || noop,
    connections: Array.isArray(connections) ? connections : [],
    setConnections: setConnections || noop,
    groups: Array.isArray(groups) ? groups : [],
    setGroups: setGroups || noop,
    isConnecting: Boolean(isConnecting),
    setIsConnecting: setIsConnecting || noop,
    firstConnectionPoint: firstConnectionPoint || null,
    setFirstConnectionPoint: setFirstConnectionPoint || noop,
    filters,
    handleFiltersChange,
    filteredProperties: safeFilteredProperties,
    dashboardStats,
    selectedProperty,
    handleSelectProperty,
    handlePolygonSelect,
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handleUpdateProperty,
    checkingPropertyMutation,
    PropertyMutationImpactDialog,
    PropertyDeletionDialogs,
    forceDataRefresh,
  };
}

