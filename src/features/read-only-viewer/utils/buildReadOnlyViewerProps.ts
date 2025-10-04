import type { ReadOnlyViewerProps } from '../types';

/**
 * Χτίζει τα props προς FloorPlanViewer για read-only χρήση.
 * Δεν αλλάζει ονόματα/δομή· μόνο “κλειδώνει” τα editing APIs σε no-op.
 * Διατηρούμε το zoom (setScale) όπως στο αρχικό.
 */
export function buildReadOnlyViewerProps(viewerProps: any): ReadOnlyViewerProps {
  return {
    ...viewerProps,
    activeTool: null,
    setActiveTool: () => {},
    handlePolygonCreated: () => {},
    handlePolygonUpdated: () => {},
    handleDuplicate: () => {},
    handleDelete: () => {},
    setConnections: () => {},
    setGroups: () => {},
    setIsConnecting: () => {},
    setFirstConnectionPoint: () => {},
    undo: () => {},
    redo: () => {},
    canUndo: false,
    canRedo: false,
    onShowHistory: () => {},
    setShowGrid: () => {},
    setSnapToGrid: () => {},
    setGridSize: () => {},
    setShowMeasurements: () => {},
    setScale: viewerProps?.setScale || (() => {}),
    isReadOnly: true,
  };
}
