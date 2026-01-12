import type { ReadOnlyViewerProps } from '../types';

// 🏢 ENTERPRISE: Input props type for viewer passthrough
interface ViewerInputProps {
  setScale?: (scale: number) => void;
  [key: string]: unknown;
}

/**
 * Χτίζει τα props προς FloorPlanViewer για read-only χρήση.
 * Δεν αλλάζει ονόματα/δομή· μόνο "κλειδώνει" τα editing APIs σε no-op.
 * Διατηρούμε το zoom (setScale) όπως στο αρχικό.
 */
export function buildReadOnlyViewerProps(viewerProps: ViewerInputProps): ReadOnlyViewerProps {
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
