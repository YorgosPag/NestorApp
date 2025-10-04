/**
 * ZOOM SYSTEM HOOK
 * Unified hook for accessing zoom functionality
 */

// Re-export existing hooks and utilities
export { useZoomWindow } from '../../hooks/useZoomWindow';
export { useZoomContext } from './ZoomSystem';

// Import for additional functionality
import { useZoomWindow } from '../../hooks/useZoomWindow';
import { useZoomContext } from './ZoomSystem';

/**
 * Main zoom hook that provides all zoom functionality
 */
export function useZoom() {
  return useZoomContext();
}

/**
 * Hook for zoom level management
 */
export function useZoomLevel() {
  const context = useZoomContext();
  return {
    currentZoom: context.currentZoom,
    setZoom: context.setZoom,
    zoomIn: context.zoomIn,
    zoomOut: context.zoomOut,
    resetZoom: context.resetZoom,
  };
}

/**
 * Hook for zoom operations (fit, region zoom)
 */
export function useZoomOperations() {
  const context = useZoomContext();
  return {
    fitToView: context.fitToView,
    zoomToRegion: context.zoomToRegion,
    currentZoom: context.currentZoom,
  };
}

/**
 * Hook for zoom window functionality
 */
export function useZoomWindowControl() {
  const context = useZoomContext();
  return context.zoomWindow;
}

/**
 * Hook for combined zoom and zoom window state
 */
export function useZoomState() {
  const context = useZoomContext();
  return {
    currentZoom: context.currentZoom,
    zoomWindowState: context.zoomWindow.state,
    isZoomWindowActive: context.zoomWindow.state.isActive,
    isZoomWindowDragging: context.zoomWindow.state.isDragging,
  };
}

// Backward compatibility
export const useZoomSystem = useZoom;