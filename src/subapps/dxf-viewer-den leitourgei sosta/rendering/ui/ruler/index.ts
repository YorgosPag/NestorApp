/**
 * RULER MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για ruler rendering
 */

// Main ruler renderer
export { RulerRenderer } from './RulerRenderer';

// ✅ REMOVED: LegacyRulerAdapter - was unused dead code

// Types και configurations
export type {
  RulerSettings,
  RulerRenderData,
  RulerRenderMode,
  RulerOrientation,
  RulerPosition
} from './RulerTypes';

export { DEFAULT_RULER_SETTINGS } from './RulerTypes';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new RulerRenderer()