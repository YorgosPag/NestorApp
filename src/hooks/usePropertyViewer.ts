
'use client';

import { usePropertyState } from './usePropertyState';
import { usePropertyEditor } from './usePropertyEditor';
import { usePropertyFilters } from './usePropertyFilters';
import { usePolygonHandlers } from './usePolygonHandlers';
import type { FilterState, PropertyStats } from '@/types/property-viewer';

const FALLBACK_FLOOR_ID = 'floor-1' as const;

export const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  propertyType: [],
  status: [],
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
  features: [],
};

export const DEFAULT_STATS: PropertyStats = {
  totalProperties: 0, availableProperties: 0, soldProperties: 0, totalValue: 0, totalArea: 0, averagePrice: 0,
  propertiesByStatus: {}, propertiesByType: {}, propertiesByFloor: {},
  totalStorageUnits: 0, availableStorageUnits: 0, soldStorageUnits: 0,
  uniqueBuildings: 0, reserved: 0
};


/**
 * Κεντρικό hook που συνδυάζει όλη τη λογική για τη διαχείριση του property viewer.
 * 
 * - `usePropertyState`: Διαχειρίζεται την κύρια κατάσταση των properties, ορόφων, επιλογών και ιστορικού.
 * - `usePropertyEditor`: Διαχειρίζεται την κατάσταση των εργαλείων του editor και των UI modes.
 * - `usePropertyFilters`: Διαχειρίζεται τη λογική του φιλτραρίσματος των properties.
 * - `usePolygonHandlers`: Διαχειρίζεται τις ενέργειες πάνω στα polygons (δημιουργία, ενημέρωση, διαγραφή).
 */
export function usePropertyViewer() {
  // 1. Core State Management (properties, selection, history)
  const {
    properties,
    setProperties,
    floors,
    isLoading,
    selectedPropertyIds,
    setSelectedProperties,
    hoveredPropertyId,
    onHoverProperty,
    selectedFloorId,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    forceDataRefresh,
  } = usePropertyState();

  // 2. Editor Tools & UI State Management
  const {
    activeTool, setActiveTool,
    showGrid, setShowGrid,
    snapToGrid, setSnapToGrid,
    gridSize, setGridSize,
    showMeasurements, setShowMeasurements,
    scale, setScale,
    showHistoryPanel, setShowHistoryPanel,
    suggestionToDisplay, setSuggestionToDisplay,
    connections, setConnections,
    groups, setGroups,
    isConnecting, setIsConnecting,
    firstConnectionPoint, setFirstConnectionPoint,
    viewMode, setViewMode,
    showDashboard, setShowDashboard,
    filters, setFilters,
  } = usePropertyEditor();

  // 3. Filtering Logic
  const { filteredProperties, stats } = usePropertyFilters(properties, filters);

  // 4. Polygon Action Handlers
  const {
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    handleUpdateProperty,
  } = usePolygonHandlers({
    properties,
    setProperties,
    setSelectedProperties,
    selectedFloorId: selectedFloorId || FALLBACK_FLOOR_ID,
    isConnecting,
    firstConnectionPoint,
    setIsConnecting,
    setFirstConnectionPoint,
  });

  // Εξασφαλίζουμε ότι οι τιμές που επιστρέφονται είναι πάντα προβλέψιμες και δεν είναι ποτέ null/undefined.
  return {
    // from usePropertyState
    properties: properties || [],
    setProperties,
    floors: floors || [],
    isLoading,
    selectedPropertyIds: selectedPropertyIds || [],
    hoveredPropertyId: hoveredPropertyId || null,
    selectedFloorId: selectedFloorId || null,
    setSelectedProperties,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    forceDataRefresh,

    // from usePropertyEditor
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
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filters: filters || DEFAULT_FILTERS,
    setFilters,

    // from usePropertyFilters
    filteredProperties: filteredProperties || [],
    stats: stats || DEFAULT_STATS,

    // from usePolygonHandlers
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    handleUpdateProperty,
  };
}
