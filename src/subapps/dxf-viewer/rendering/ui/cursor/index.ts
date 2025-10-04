/**
 * CURSOR MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για cursor rendering
 */

// Main cursor renderer
export { CursorRenderer } from './CursorRenderer';

// Types και configurations
export type {
  UICursorSettings,
  CursorRenderData,
  CursorRenderMode,
  CursorShape,
  CursorLineStyle
} from './CursorTypes';

export { DEFAULT_UI_CURSOR_SETTINGS } from './CursorTypes';

// ✅ REMOVED: Περιττή wrapper function - χρησιμοποιήστε απευθείας new CursorRenderer()