'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePropertyViewer, DEFAULT_FILTERS } from '@/hooks/usePropertyViewer';
import { useAuth } from '@/hooks/useAuth';
import { ContactsService } from '@/services/contacts.service';
import { createModuleLogger } from '@/lib/telemetry';
import { tallyBy } from '@/utils/collection-utils';
import type { Connection } from '@/types/connections';
import type { FilterState, Property } from '@/types/property-viewer';

const logger = createModuleLogger('usePropertiesViewerState');

const noop = () => {};

export function usePropertiesViewerState() {
  const searchParams = useSearchParams();
  const propertyIdFromUrl = searchParams.get('propertyId');

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
    setFilters,
    filteredProperties,
    isLoading,
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

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
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

  useEffect(() => {
    if (!propertyIdFromUrl || properties.length === 0 || !setSelectedProperties) {
      return;
    }

    const propertyExists = properties.some((property) => property.id === propertyIdFromUrl);
    if (!propertyExists) {
      logger.warn('Property not found in properties', { propertyId: propertyIdFromUrl });
      return;
    }

    setSelectedProperties([propertyIdFromUrl]);
    const property = properties.find((item) => item.id === propertyIdFromUrl);
    if (property?.floorId && onSelectFloor) {
      onSelectFloor(property.floorId);
    }
  }, [onSelectFloor, properties, propertyIdFromUrl, setSelectedProperties]);

  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];
  const safeFloors = Array.isArray(floors) ? floors : [];

  const selectedProperty = useMemo(() => {
    const safeSelectedPropertyIds = Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [];
    if (safeSelectedPropertyIds.length !== 1) {
      return null;
    }

    const property = safeProperties.find((item) => item.id === safeSelectedPropertyIds[0]);
    if (property && property.soldTo && allContactIds.length > 0) {
      return {
        ...property,
        buyerMismatch: !allContactIds.includes(property.soldTo),
      };
    }

    return property ?? null;
  }, [allContactIds, safeProperties, selectedPropertyIds]);

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

  const dashboardStats = useMemo(() => ({
    totalProperties: safeProperties.length,
    totalArea: safeProperties.reduce((sum, property) => sum + (property.area || 0), 0),
    uniqueBuildings: [...new Set(safeProperties.map((property) => property.building))].length,
    availableProperties: safeProperties.filter((property) => property.operationalStatus === 'ready').length,
    underConstructionProperties: safeProperties.filter((property) => property.operationalStatus === 'under-construction').length,
    maintenanceProperties: safeProperties.filter((property) => property.operationalStatus === 'maintenance').length,
    inspectionProperties: safeProperties.filter((property) => property.operationalStatus === 'inspection').length,
    draftProperties: safeProperties.filter((property) => property.operationalStatus === 'draft').length,
    propertiesByStatus: tallyBy(safeProperties, (property) => property.operationalStatus || 'draft'),
    propertiesByType: tallyBy(safeProperties, (property) => property.type),
    propertiesByFloor: tallyBy(safeProperties, (property) => `Floor ${property.floor}`),
    totalStorageUnits: 0,
    availableStorageUnits: 0,
    coverage: (() => {
      const totalProperties = safeProperties.length;
      const propertiesWithPhotos = safeProperties.filter((property) => property.propertyCoverage?.hasPhotos === true).length;
      const propertiesWithFloorplans = safeProperties.filter((property) => property.propertyCoverage?.hasFloorplans === true).length;
      const propertiesWithDocuments = safeProperties.filter((property) => property.propertyCoverage?.hasDocuments === true).length;

      return {
        totalProperties,
        propertiesWithPhotos,
        propertiesWithFloorplans,
        propertiesWithDocuments,
        photosPercentage: totalProperties > 0 ? Math.round((propertiesWithPhotos / totalProperties) * 100) : 0,
        floorplansPercentage: totalProperties > 0 ? Math.round((propertiesWithFloorplans / totalProperties) * 100) : 0,
        documentsPercentage: totalProperties > 0 ? Math.round((propertiesWithDocuments / totalProperties) * 100) : 0,
      };
    })(),
  }), [safeProperties]);

  const handleFiltersChange = (newFilters: Partial<FilterState> | Record<string, unknown>) => {
    logger.info('Filters change', {
      hasAreaRange: typeof newFilters === 'object' && newFilters !== null && 'areaRange' in newFilters,
    });

    if (setFilters) {
      setFilters((previous: FilterState) => {
        const updated = { ...previous, ...newFilters } as FilterState;
        logger.info('Updated filters', {
          updatedAreaRange: updated.areaRange,
        });
        return updated;
      });
    }
  };

  return {
    properties: safeProperties,
    loading: isLoading,
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
    viewMode,
    setViewMode,
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
    filters: filters || DEFAULT_FILTERS,
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

