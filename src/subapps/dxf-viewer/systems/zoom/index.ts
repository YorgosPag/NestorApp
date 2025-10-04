/**
 * ZOOM SYSTEM - MAIN EXPORTS
 * Κεντρικοποιημένο zoom management με επαγγελματικές λειτουργίες
 */

// === MAIN CLASSES ===
export { ZoomManager } from './ZoomManager';

// === REACT HOOKS ===
export { useZoom } from './hooks/useZoom';

// === TYPES ===
export type {
  ZoomMode,
  ZoomDirection,
  ZoomConfig,
  ZoomOperation,
  ZoomResult,
  ZoomHistoryEntry,
  ZoomConstraints,
  ZoomEvent,
  IZoomManager
} from './zoom-types';

// === CONSTANTS ===
export {
  DEFAULT_ZOOM_CONFIG,
  ZOOM_FACTORS,
  ZOOM_LIMITS,
  ZOOM_KEYS,
  ZOOM_ANIMATION,
  VIEWPORT_DEFAULTS
} from './zoom-constants';

// === UTILITIES ===
export * from './utils';