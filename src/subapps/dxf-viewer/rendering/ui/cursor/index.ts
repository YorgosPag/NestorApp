/**
 * CURSOR MODULE - Public API
 * ✅ ΦΑΣΗ 6: Centralized exports για cursor rendering
 */

// ADR-040 Φ10: CursorRenderer + LegacyCursorAdapter deleted (dead code — the
// compositor <CrosshairOverlay> is the sole cursor/pickbox renderer). Types kept.

// Types και configurations
export type {
  UICursorSettings,
  CursorRenderData,
  CursorRenderMode,
  CursorShape,
  CursorLineStyle
} from './CursorTypes';

export { DEFAULT_UI_CURSOR_SETTINGS } from './CursorTypes';