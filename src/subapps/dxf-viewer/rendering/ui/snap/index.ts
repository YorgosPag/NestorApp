/**
 * SNAP MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για snap rendering
 */

// Main snap renderer
export { SnapRenderer } from './SnapRenderer';

// Legacy compatibility
export { LegacySnapAdapter } from './LegacySnapAdapter';

// Types και configurations
export type {
  SnapSettings,
  SnapResult,
  SnapRenderData,
  SnapRenderMode,
  SnapType
} from './SnapTypes';

export { DEFAULT_SNAP_SETTINGS } from './SnapTypes';

// 🏢 ADR-137: Snap Icon Geometry Centralization
export {
  SNAP_ICON_GEOMETRY,
  getSnapIconHalf,
  getSnapIconQuarter,
  getTangentCircleRadius,
  getGridDotRadius,
  getNodeDotRadius
} from './snap-icon-config';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new SnapRenderer()