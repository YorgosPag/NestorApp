/**
 * GRID MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για grid rendering
 */

// Main grid renderer
export { GridRenderer } from './GridRenderer';

// Legacy compatibility
export { LegacyGridAdapter } from './LegacyGridAdapter';

// Types και configurations
export type {
  GridSettings,
  GridRenderData,
  GridRenderMode,
  GridStyle
} from './GridTypes';

export { DEFAULT_GRID_SETTINGS } from './GridTypes';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new GridRenderer()