/**
 * ZOOM SYSTEM
 * Centralized zoom management with window selection functionality
 */

// Configuration and types
export * from './config';

// Utilities
export * from './utils';

// Hooks (can be imported safely)
export { 
  useZoom, 
  useZoomLevel, 
  useZoomOperations, 
  useZoomWindowControl, 
  useZoomState,
  useZoomSystem 
} from './useZoom';

// Re-export existing zoom components for easy access
export { useZoomWindow } from '../../hooks/useZoomWindow';

// Re-export UI components for easy access
export { ZoomControls } from '../../ui/toolbar/ZoomControls';
export { default as ZoomWindowOverlay } from '../../canvas/ZoomWindowOverlay';

// Components need to be imported from .tsx files directly
// For components, import directly: import { ZoomSystem } from './systems/zoom/ZoomSystem';

// Re-export main system component for convenience
export { ZoomSystem, useZoomContext } from './ZoomSystem';