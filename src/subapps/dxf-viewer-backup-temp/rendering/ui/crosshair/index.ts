/**
 * CROSSHAIR MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για crosshair rendering
 */

// Main crosshair renderer
export { CrosshairRenderer } from './CrosshairRenderer';

// Types και configurations
export type {
  CrosshairSettings,
  CrosshairRenderData,
  CrosshairRenderMode,
  CrosshairLineStyle
} from './CrosshairTypes';

export { DEFAULT_CROSSHAIR_SETTINGS } from './CrosshairTypes';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new CrosshairRenderer()