/**
 * GRID TYPES - Centralized types για grid rendering
 * ✅ ΦΑΣΗ 6: Unified grid interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';
// 🏢 ADR-134: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../../../config/color-config';
// 🏢 ADR-034: Centralized Rendering Z-Index
import { RENDERING_ZINDEX } from '../../../config/tolerance-config';
// 🏢 SSoT: Axis/origin defaults — single source of truth
import { GRID_AXES_DEFAULTS } from '../../../config/grid-axis-defaults';
// 🏢 ADR-516: Timing & Latency SSoT
import { DXF_TIMING } from '../../../config/dxf-timing';

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

  /**
   * Minor grid line thickness. **The only line-weight input**: the major
   * weight is derived from it via `config/grid-emphasis.ts`, because their
   * RATIO is what decides whether a cascade role-swap reads as an event
   * (ADR-681 §5.7).
   */
  readonly minorGridWeight: number;

  // 🌊 ADAPTIVE GRID — multi-level smooth fade
  readonly smoothFade: boolean;       // Enable per-level smooth opacity transition
  readonly smoothFadeDurationMs: number; // Temporal lerp duration (0 = instant)

  /**
   * 🪜 CASCADE ANCHOR — the MINOR level's screen spacing (px) at which the grid
   * coarsens. **This is the single density knob.** The band top and the
   * cross-fade window are DERIVED from it inside `computeAdaptiveLevels`:
   *
   *  - band top      = `minGridSpacing * majorInterval` (one cascade period)
   *  - minor opacity = `1 - log_majorInterval(bandTop / minorPx)`  (C4D model)
   *
   * They are not settings because they are not free: a band that does not span
   * exactly one cascade period, or a fade window that does not cover exactly
   * that band, reintroduces the density pop. Three separate 2026-07-20 defects
   * were all this same shape — coupled quantities configured independently and
   * drifting apart. See `grid-adaptive.ts` for the arithmetic.
   *
   * Engineering constant, not a user preference — deliberately NOT sourced from
   * `rulers-grid/config.ts` `behavior.minGridSpacing/maxGridSpacing`, which are
   * ruler/snap-step values with different semantics.
   */
  readonly minGridSpacing: number;

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

  // Major weight is DERIVED (× GRID_MAJOR_EMPHASIS_RATIO) — see grid-emphasis.ts
  minorGridWeight: 1,

  // 🏢 ORIGIN & AXES: AutoCAD-style UCS icon defaults — SSoT: config/grid-axis-defaults.ts
  showOrigin: GRID_AXES_DEFAULTS.showOrigin,
  showAxes: GRID_AXES_DEFAULTS.showAxes,
  axesColor: GRID_AXES_DEFAULTS.axesColor,
  axesWeight: GRID_AXES_DEFAULTS.axesWeight,

  // 🌊 Adaptive grid — opt-in. Default OFF so the renderer uses the legacy
  // 2-pass minor+major draw with the user's panel colors directly.
  smoothFade: false,
  smoothFadeDurationMs: DXF_TIMING.animation.FADE, // ADR-516

  // 🪜 Cascade anchor — minor lines coarsen at 10 screen px, so the derived
  // band is 10-50 px and major lands at 50-250 px with 5 subdivisions
  // (AutoCAD GRIDDISPLAY / Fusion 360 feel).
  minGridSpacing: 10,

  zIndex: RENDERING_ZINDEX.GRID  // 🏢 ADR-034: Centralized z-index (10)
};