/**
 * GRID TYPES - Centralized types για grid rendering
 * ✅ ΦΑΣΗ 6: Unified grid interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';
// 🏢 ADR-134: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../../../config/color-config';
// 🏢 ADR-034: Centralized Rendering Z-Index
import { RENDERING_ZINDEX } from '../../../config/tolerance-config';

/**
 * 🔺 GRID STYLES
 * Different grid visualization styles
 */
export type GridStyle =
  | 'lines'     // Grid lines
  | 'dots'      // Grid dots
  | 'crosses';  // Grid crosses

/**
 * 🔺 GRID SETTINGS
 * Centralized interface για grid configuration
 * Extends UIElementSettings για consistency
 */
export interface GridSettings extends UIElementSettings {
  readonly color: string;
  readonly size: number;           // Grid spacing in world units
  readonly style: GridStyle;
  readonly lineWidth: number;

  // Advanced features
  readonly majorGridColor: string;
  readonly minorGridColor: string;
  readonly majorInterval: number;  // Major grid lines every N intervals
  readonly showMajorGrid: boolean;
  readonly showMinorGrid: boolean;
  readonly adaptiveOpacity: boolean; // Fade out when zoomed out
  readonly minVisibleSize: number;   // Minimum pixel size to show grid

  // ✅ ENTERPRISE FIX: Missing properties used by GridRenderer
  readonly majorGridWeight: number; // Major grid line thickness
  readonly minorGridWeight: number; // Minor grid line thickness

  // 🏢 ORIGIN & AXES: AutoCAD-style UCS icon (consolidated from rulers-grid/config.ts)
  readonly showOrigin: boolean;     // Show origin crosshair at world (0,0)
  readonly showAxes: boolean;       // Show X/Y axis lines through origin
  readonly axesColor: string;       // Color for axis lines
  readonly axesWeight: number;      // Line width for axis lines
}

/**
 * 🔺 GRID RENDER DATA
 * Data που χρειάζεται το GridRenderer
 */
export interface GridRenderData {
  readonly settings: GridSettings;
  readonly scale: number;          // Current zoom scale
  readonly offset: { x: number; y: number }; // Current pan offset
  readonly timestamp?: number;     // For animations
}

/**
 * 🔺 GRID RENDER MODES
 * Different rendering approaches
 */
export type GridRenderMode =
  | 'normal'      // Standard grid
  | 'adaptive'    // Adaptive grid based on zoom
  | 'blueprint';  // Blueprint-style grid

/**
 * 🔺 DEFAULT GRID SETTINGS
 * Sensible defaults για grid rendering
 */
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  opacity: OPACITY.VERY_LOW,  // 🏢 ADR-134: Centralized opacity (0.3)
  color: UI_COLORS.MEDIUM_GRAY,
  size: 10,              // 10 units spacing
  style: 'lines',
  lineWidth: 1,

  // Advanced features
  majorGridColor: UI_COLORS.GRID_MAJOR,
  minorGridColor: UI_COLORS.GRID_MINOR,
  majorInterval: 5,      // Major grid every 5 intervals
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: true,
  minVisibleSize: 5,     // Don't show grid if smaller than 5px

  // ✅ ENTERPRISE FIX: Default values for missing properties
  majorGridWeight: 2,    // Thicker major grid lines
  minorGridWeight: 1,    // Standard minor grid lines

  // 🏢 ORIGIN & AXES: AutoCAD-style UCS icon defaults
  showOrigin: true,      // Show origin crosshair at world (0,0) — AutoCAD always shows UCS icon
  showAxes: true,        // Show X/Y axis lines through origin
  axesColor: UI_COLORS.RULER_DARK_GRAY, // Neutral gray for axes
  axesWeight: 2,         // Prominent axis lines

  zIndex: RENDERING_ZINDEX.GRID  // 🏢 ADR-034: Centralized z-index (10)
};