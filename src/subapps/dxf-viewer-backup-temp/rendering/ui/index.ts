/**
 * UI RENDERING SYSTEM - Central Public API
 * ✅ ΦΑΣΗ 6: Unified exports για όλο το UI rendering infrastructure
 */

// === CORE INFRASTRUCTURE ===
export type {
  UIRenderer,
  UIRenderContext,
  UICoordinateSystem,
  UITransform,
  UIElementSettings,
  UIRenderMetrics,
  UIRendererFactory,
  UIRenderOptions
} from './core/UIRenderer';

export {
  ScreenUICoordinateSystem,
  UIRenderContextImpl,
  createUIRenderContext,
  DEFAULT_UI_TRANSFORM
} from './core/UIRenderContext';

export {
  UIRendererComposite,
  type UICategory
} from './core/UIRendererComposite';

// === CROSSHAIR RENDERING ===
export { CrosshairRenderer } from './crosshair/CrosshairRenderer';
export { LegacyCrosshairAdapter } from './crosshair/LegacyCrosshairAdapter';
export type {
  CrosshairSettings,
  CrosshairRenderData,
  CrosshairRenderMode,
  CrosshairLineStyle
} from './crosshair/CrosshairTypes';
export { DEFAULT_CROSSHAIR_SETTINGS } from './crosshair/CrosshairTypes';

// === CURSOR RENDERING ===
export { CursorRenderer } from './cursor/CursorRenderer';
export { LegacyCursorAdapter } from './cursor/LegacyCursorAdapter';
export type {
  UICursorSettings,
  CursorRenderData,
  CursorRenderMode,
  CursorShape,
  CursorLineStyle
} from './cursor/CursorTypes';
export { DEFAULT_UI_CURSOR_SETTINGS } from './cursor/CursorTypes';

// === SNAP RENDERING ===
export { SnapRenderer } from './snap/SnapRenderer';
export { LegacySnapAdapter } from './snap/LegacySnapAdapter';
export type {
  SnapSettings,
  SnapResult,
  SnapRenderData,
  SnapRenderMode,
  SnapType
} from './snap/SnapTypes';
export { DEFAULT_SNAP_SETTINGS } from './snap/SnapTypes';

// === GRID RENDERING ===
export { GridRenderer } from './grid/GridRenderer';
export { LegacyGridAdapter } from './grid/LegacyGridAdapter';
export type {
  GridSettings,
  GridRenderData,
  GridRenderMode,
  GridStyle
} from './grid/GridTypes';
export { DEFAULT_GRID_SETTINGS } from './grid/GridTypes';

// === RULER RENDERING ===
export { RulerRenderer } from './ruler/RulerRenderer';
// ✅ REMOVED: LegacyRulerAdapter - was unused dead code
export type {
  RulerSettings,
  RulerRenderData,
  RulerRenderMode,
  RulerOrientation,
  RulerPosition
} from './ruler/RulerTypes';
export { DEFAULT_RULER_SETTINGS } from './ruler/RulerTypes';

// === SELECTION RENDERING ===
export { SelectionRenderer } from '../../canvas-v2/layer-canvas/selection/SelectionRenderer';
export type {
  SelectionSettings,
  SelectionBox
} from '../../canvas-v2/layer-canvas/layer-types';

// ✅ REMOVED: Περιττές wrapper factory functions
// Οι developers μπορούν να χρησιμοποιούν απευθείας τα classes με new