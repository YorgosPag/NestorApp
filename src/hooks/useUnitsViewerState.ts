
'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePropertyViewer, DEFAULT_FILTERS } from '@/hooks/usePropertyViewer';
import type { Property } from '@/types/property-viewer';
import type { Connection } from '@/types/connections';
import type { FilterState } from '@/types/property-viewer';
import { useSearchParams } from 'next/navigation';
import { ContactsService } from '@/services/contacts.service';
import { BUILDING_IDS } from '@/config/building-ids-config';

const noop = () => {};

export function useUnitsViewerState() {
  const searchParams = useSearchParams();
  const unitIdFromUrl = searchParams.get('unitId');
  
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
    forceDataRefresh,
  } = usePropertyViewer();

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [allContactIds, setAllContactIds] = useState<string[]>([]);
  
  useEffect(() => {
    async function fetchContactIds() {
        try {
            const ids = await ContactsService.getAllContactIds();
            setAllContactIds(ids);
        } catch (error) {
            console.error("Failed to fetch contact IDs:", error);
        }
    }
    fetchContactIds();
  }, []);

  // 🏢 ENTERPRISE: Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (unitIdFromUrl && properties.length > 0 && setSelectedProperties) {
      const unitExists = properties.some(p => p.id === unitIdFromUrl);
      if (unitExists) {
        setSelectedProperties([unitIdFromUrl]);
        // Also select the correct floor
        const unit = properties.find(p => p.id === unitIdFromUrl);
        if (unit?.floorId && onSelectFloor) {
            onSelectFloor(unit.floorId);
        }
      } else {
        console.warn('⚠️ [useUnitsViewerState] Unit not found in properties:', unitIdFromUrl);
      }
    }
  }, [unitIdFromUrl, properties, setSelectedProperties, onSelectFloor]);

  const safeProperties = Array.isArray(properties) ? properties : [];
  const safeFilteredProperties = Array.isArray(filteredProperties) ? filteredProperties : [];
  const safeFloors = Array.isArray(floors) ? floors : [];

  const selectedUnit = useMemo(() => {
    const safeSelectedPropertyIds = Array.isArray(selectedPropertyIds) ? selectedPropertyIds : [];
    if (safeSelectedPropertyIds.length === 1) {
      const unit = safeProperties.find(p => p.id === safeSelectedPropertyIds[0]);
      if (unit && unit.soldTo && allContactIds.length > 0) {
        return {
          ...unit,
          buyerMismatch: !allContactIds.includes(unit.soldTo),
        };
      }
      return unit;
    }
    return null;
  }, [selectedPropertyIds, safeProperties, allContactIds]);

  const handleSelectUnit = (unit: Property) => {
    if (setSelectedProperties) {
      setSelectedProperties([unit.id]);
    }
  };
  
  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    if (!setSelectedProperties) return;
    
    // Special keywords for bulk actions
    if (propertyId === '__all__') {
        setSelectedProperties(safeFilteredProperties.map(p => p.id));
        return;
    }
    if (propertyId === '__none__') {
        setSelectedProperties([]);
        return;
    }

    setSelectedProperties((prev: string[]) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (!propertyId) return [];
      if (isShiftClick) {
        return safePrev.includes(propertyId) 
          ? safePrev.filter(id => id !== propertyId) 
          : [...safePrev, propertyId];
      }
      // If not shift-clicking, and the item is already the only one selected, deselect it. Otherwise, select just this one.
      return safePrev.length === 1 && safePrev[0] === propertyId ? [] : [propertyId];
    });

    if (isConnecting && !isShiftClick) {
      const property = safeProperties.find(p => p.id === propertyId);
      if (!property) return;
      if (!firstConnectionPoint) {
        if (setFirstConnectionPoint) {
          setFirstConnectionPoint(property);
        }
      } else {
        if (firstConnectionPoint.id === property.id) return;
        if (setConnections) {
          setConnections((prev: Connection[]) => [
            ...(Array.isArray(prev) ? prev : []), 
            { 
              id: `conn_${firstConnectionPoint.id}_${property.id}`, 
              from: firstConnectionPoint.id, 
              to: property.id, 
              type: 'related' 
            }
          ]);
        }
        if (setFirstConnectionPoint) setFirstConnectionPoint(null);
        if (setIsConnecting) setIsConnecting(false);
      }
    }
  };

  const handlePolygonCreated = (newPropertyData: Omit<Property, 'id' | 'name' | 'type' | 'status' | 'building' | 'floor' | 'project' | 'buildingId' | 'floorId'>) => {
    if (!setProperties) return;
    
    // 🎯 DOMAIN SEPARATION: Default operationalStatus='draft' (NOT sales status!)
    const newProperty: Property = {
      id: `prop_${Date.now()}`,
      name: `Νέο Ακίνητο ${safeProperties.length + 1}`,
      type: 'Διαμέρισμα 2Δ',
      status: 'for-sale', // ⚠️ DEPRECATED: Legacy field (required for type compatibility)
      operationalStatus: 'draft', // 🏢 ENTERPRISE: New units start as draft
      building: 'Κτίριο Alpha',
      floor: 1,
      project: 'Έργο Κέντρο',
      buildingId: BUILDING_IDS.LEGACY_BUILDING_1,
      floorId: selectedFloorId || 'floor-1',
      ...newPropertyData,
    };
    setProperties([...safeProperties, newProperty], `Created property ${newProperty.name}`);
  };

  const handlePolygonUpdated = (polygonId: string, vertices: Array<{ x: number; y: number }>) => {
    if (!setProperties) return;
    
    setProperties(
      safeProperties.map(p => p.id === polygonId ? { ...p, vertices } : p),
      `Updated vertices for property ${polygonId}`
    );
  };

  const handleDuplicate = (propertyId: string) => {
    if (!setProperties) return;
    
    const propertyToDuplicate = safeProperties.find(p => p.id === propertyId);
    if (!propertyToDuplicate) return;
    const newProperty: Property = {
      ...propertyToDuplicate,
      id: `prop_${Date.now()}`,
      name: `${propertyToDuplicate.name} (Αντίγραφο)`,
      vertices: (propertyToDuplicate.vertices || []).map(v => ({ x: v.x + 20, y: v.y + 20 })),
    };
    setProperties([...safeProperties, newProperty], `Duplicated property ${propertyToDuplicate.name}`);
  };

  const handleDelete = (propertyId: string) => {
    if (!setProperties) return;
    
    setProperties(
      safeProperties.filter(p => p.id !== propertyId),
      `Deleted property ${propertyId}`
    );
  };

  const dashboardStats = useMemo(() => ({
    // ✅ PHYSICAL METRICS (Unit = Physical Truth)
    totalProperties: safeProperties.length,
    totalArea: safeProperties.reduce((sum, p) => sum + (p.area || 0), 0),
    uniqueBuildings: [...new Set(safeProperties.map(p => p.building))].length,

    // 🎯 DOMAIN SEPARATION: OPERATIONAL STATUS METRICS (Physical readiness - NO SALES!)
    // Units = Physical Truth, Sales = Commercial Truth (separate module)
    availableProperties: safeProperties.filter(p => p.operationalStatus === 'ready').length,
    underConstructionProperties: safeProperties.filter(p => p.operationalStatus === 'under-construction').length,
    maintenanceProperties: safeProperties.filter(p => p.operationalStatus === 'maintenance').length,
    inspectionProperties: safeProperties.filter(p => p.operationalStatus === 'inspection').length,
    draftProperties: safeProperties.filter(p => p.operationalStatus === 'draft').length,

    // ✅ DISTRIBUTION METRICS (Physical attributes)
    // 🎯 DOMAIN SEPARATION: Uses operationalStatus (NOT sales status!)
    propertiesByStatus: safeProperties.reduce((acc, p) => {
      const status = p.operationalStatus || 'draft';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    propertiesByType: safeProperties.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    propertiesByFloor: safeProperties.reduce((acc, p) => {
      const floorLabel = `Όροφος ${p.floor}`;
      acc[floorLabel] = (acc[floorLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),

    // ✅ STORAGE METRICS (Physical inventory - Operational status only)
    // 🎯 DOMAIN SEPARATION: No "sold" storage - that's sales data!
    totalStorageUnits: 0,
    availableStorageUnits: 0, // Storage units with operationalStatus='ready'

    // ✅ ENTERPRISE: Coverage stats for Πληρότητα card (PR1.2)
    // ⚠️ BACKWARD COMPATIBILITY: Handle missing unitCoverage until backfill completes
    coverage: (() => {
      const totalUnits = safeProperties.length;
      const unitsWithPhotos = safeProperties.filter(p => p.unitCoverage?.hasPhotos === true).length;
      const unitsWithFloorplans = safeProperties.filter(p => p.unitCoverage?.hasFloorplans === true).length;
      const unitsWithDocuments = safeProperties.filter(p => p.unitCoverage?.hasDocuments === true).length;
      return {
        totalUnits,
        unitsWithPhotos,
        unitsWithFloorplans,
        unitsWithDocuments,
        photosPercentage: totalUnits > 0 ? Math.round((unitsWithPhotos / totalUnits) * 100) : 0,
        floorplansPercentage: totalUnits > 0 ? Math.round((unitsWithFloorplans / totalUnits) * 100) : 0,
        documentsPercentage: totalUnits > 0 ? Math.round((unitsWithDocuments / totalUnits) * 100) : 0,
      };
    })(),
  }), [safeProperties]);

  // 🏢 ENTERPRISE: Flexible filter handler compatible with AdvancedFiltersPanel
  const handleFiltersChange = (newFilters: Partial<FilterState> | Record<string, unknown>) => {
    if (setFilters) {
      setFilters((prev: FilterState) => ({ ...prev, ...newFilters } as FilterState));
    }
  };

  return {
    properties: safeProperties,
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
    selectedUnit,
    handleSelectUnit,
    handlePolygonSelect,
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    forceDataRefresh,
  };
}
