import type { Property } from '@/types/property-viewer';
import type { Connection, PropertyGroup } from '@/types/connections';
import type { ViewerProps, PublicViewerHookShape, PolygonEventArgs } from '../../property-management/types/publicViewer';

/**
 * 🏢 ENTERPRISE: Build ViewerProps from PublicViewerHookShape
 * Creates adapter functions for read-only mode compatibility
 */
export function buildViewerProps(h: PublicViewerHookShape): ViewerProps {
  // Create no-op adapter functions with correct signatures for read-only mode
  const noOpSetProperties = (_v: Property[]): void => { /* read-only */ };
  const noOpSetActiveTool = (_t: string | null): void => { /* read-only */ };
  const noOpSetShowGrid = (_v: boolean): void => { /* read-only */ };
  const noOpSetSnapToGrid = (_v: boolean): void => { /* read-only */ };
  const noOpSetGridSize = (_v: number): void => { /* read-only */ };
  const noOpSetShowMeasurements = (_v: boolean): void => { /* read-only */ };
  const noOpPolygonCreated = (_args: PolygonEventArgs): void => { /* read-only */ };
  const noOpPolygonUpdated = (_args: PolygonEventArgs): void => { /* read-only */ };
  const noOpDuplicate = (_ids: string[]): void => { /* read-only */ };
  const noOpDelete = (_ids: string[]): void => { /* read-only */ };
  const noOpSetConnections = (_v: Connection[]): void => { /* read-only */ };
  const noOpSetGroups = (_v: PropertyGroup[]): void => { /* read-only */ };
  const noOpSetIsConnecting = (_v: boolean): void => { /* read-only */ };
  const noOpSetFirstConnectionPoint = (_v: Property | null): void => { /* read-only */ };
  const noOpOnHoverProperty = (_id?: string | null): void => {
    // Delegate to actual hover handler for visual feedback
    h.onHoverProperty(_id ?? null);
  };
  const noOpOnSelectFloor = (floorId: string | null): void => {
    // Delegate to actual floor select for navigation
    h.onSelectFloor(floorId);
  };

  // Adapter for handlePolygonSelect - ViewerProps expects (id: string | null)
  // but hook returns (propertyId: string, isShiftClick: boolean)
  const adaptedPolygonSelect = (id: string | null): void => {
    h.handlePolygonSelect(id ?? '', false);
  };

  return {
    properties: h.properties,
    setProperties: noOpSetProperties,
    selectedPropertyIds: h.selectedPropertyIds,
    hoveredPropertyId: h.hoveredPropertyId,
    selectedFloorId: h.selectedFloorId,
    onHoverProperty: noOpOnHoverProperty,
    onSelectFloor: noOpOnSelectFloor,
    undo: h.undo,
    redo: h.redo,
    canUndo: false,
    canRedo: false,
    setSelectedProperties: h.setSelectedProperties,
    floors: h.floors,
    currentFloor: h.currentFloor,
    activeTool: h.activeTool,
    setActiveTool: noOpSetActiveTool,
    showGrid: h.showGrid,
    setShowGrid: noOpSetShowGrid,
    snapToGrid: h.snapToGrid,
    setSnapToGrid: noOpSetSnapToGrid,
    gridSize: h.gridSize,
    setGridSize: noOpSetGridSize,
    showMeasurements: h.showMeasurements,
    setShowMeasurements: noOpSetShowMeasurements,
    scale: h.scale,
    setScale: h.setScale,
    handlePolygonSelect: adaptedPolygonSelect,
    handlePolygonCreated: noOpPolygonCreated,
    handlePolygonUpdated: noOpPolygonUpdated,
    handleDuplicate: noOpDuplicate,
    handleDelete: noOpDelete,
    suggestionToDisplay: h.suggestionToDisplay,
    connections: h.connections,
    setConnections: noOpSetConnections,
    groups: h.groups,
    setGroups: noOpSetGroups,
    isConnecting: false,
    setIsConnecting: noOpSetIsConnecting,
    firstConnectionPoint: h.firstConnectionPoint,
    setFirstConnectionPoint: noOpSetFirstConnectionPoint,
    isReadOnly: true,
  };
}
