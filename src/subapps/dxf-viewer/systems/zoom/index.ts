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
// 🏢 ADR-043: Direct export from centralized config (eliminated zoom-constants middleman)
export {
  DEFAULT_ZOOM_CONFIG,
  ZOOM_FACTORS,
  ZOOM_LIMITS,
  ZOOM_KEYS,
  ZOOM_ANIMATION,
  VIEWPORT_DEFAULTS
} from '../../config/transform-config';

// === UTILITIES ===
export * from './utils';

// === ZOOM STORE (ADR-040 Phase VII) ===
export { ZoomStore, useCurrentZoom } from './ZoomStore';