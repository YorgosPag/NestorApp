import type { ViewerProps, PublicViewerHookShape } from '../../property-management/types/publicViewer';

/**
 * 🏢 ENTERPRISE: Build ViewerProps from PublicViewerHookShape
 * Keeps only the capabilities that this viewer surface actually supports.
 *
 * ⚠️ **ADR-840 Σ2 — ΕΔΩ ΖΟΥΣΕ Η ΤΡΙΤΗ ΣΤΑΘΕΡΑ.** Η γραμμή έγραφε `isReadOnly: true`
 * αγνοώντας ολότελα το `h.isReadOnly` που της έδινε ο hook: δηλαδή ακόμη κι αν ο
 * hook αποφάσιζε σωστά, ο μεταφορέας το **ξαναέγραφε**. Ο μεταφορέας **μεταφέρει**.
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
    onHoverProperty: (id) => h.onHoverProperty(id ?? null),
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
    isReadOnly: h.isReadOnly,
  };
}
