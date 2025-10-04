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

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new SnapRenderer()