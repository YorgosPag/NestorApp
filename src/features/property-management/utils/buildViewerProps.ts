import type { ViewerProps, PublicViewerHookShape } from '../../property-management/types/publicViewer';

/**
 * 🏢 ENTERPRISE: Build ViewerProps from PublicViewerHookShape
 * Keeps only the read-only capabilities that the public viewer actually supports.
 */
export function buildViewerProps(h: PublicViewerHookShape): ViewerProps {
  const adaptedPolygonSelect = (id: string | null): void => {
    h.handlePolygonSelect(id ?? '', false);
  };

  return {
    properties: h.properties,
    selectedPropertyIds: h.selectedPropertyIds,
    hoveredPropertyId: h.hoveredPropertyId,
    selectedFloorId: h.selectedFloorId,
    onHoverProperty: h.onHoverProperty,
    onSelectFloor: h.onSelectFloor,
    canUndo: false,
    canRedo: false,
    setSelectedProperties: h.setSelectedProperties,
    floors: h.floors,
    currentFloor: h.currentFloor,
    activeTool: h.activeTool,
    showGrid: h.showGrid,
    snapToGrid: h.snapToGrid,
    gridSize: h.gridSize,
    showMeasurements: h.showMeasurements,
    scale: h.scale,
    setScale: h.setScale,
    handlePolygonSelect: adaptedPolygonSelect,
    suggestionToDisplay: h.suggestionToDisplay,
    connections: h.connections,
    groups: h.groups,
    isConnecting: false,
    firstConnectionPoint: h.firstConnectionPoint,
    isReadOnly: true,
  };
}
