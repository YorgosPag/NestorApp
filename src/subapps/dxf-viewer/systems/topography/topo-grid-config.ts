/**
 * ADR-656 M11 — ΕΓΣΑ87 coordinate-grid (TOPO-GRID) configuration (data only, no logic).
 *
 * The perimeter coordinate graticule every serious topographic sheet carries (Civil 3D
 * «Coordinate Grid» / Trimble / Carlson· υποχρεωτικό στο εξαρτημένο τοπογραφικό ΤΕΕ/ΕΓΣΑ87):
 * grid crosses at ROUND coordinate values with Easting/Northing numbering at the margin.
 * This is SEPARATE from the drawing-aid «ΠΛΕΓΜΑ / F7» grid (`GridRenderer`) — different
 * store, toggle and shortcut.
 *
 * Frame ADR-462: all world coordinates ARE ΕΓΣΑ87 in canonical mm, so `ΕΓΣΑ87_m = worldMm/1000`
 * and the grid origin is the world origin (identity). The step ladder is the survey-appropriate
 * subset of the RulerRenderer 1-2-5 sequence (`ADAPTIVE_INTERVALS`), expressed in mm so the pure
 * model never inlines a `×1000`.
 *
 * Layer NAME is a structural DXF identifier (like the contour/point-label layers), so it lives
 * as a config constant — NOT a `t()` key (N.11). UI copy stays in the locale files.
 */

/** DXF layer name for the baked coordinate-grid entities — structural id, not UI copy. */
export const TOPO_GRID_LAYER_NAME = 'TOPO-GRID' as const;

/** Colour of the grid crosses/ticks (blue-grey graticule — Civil 3D coordinate-grid convention). */
export const TOPO_GRID_COLOR = '#5B6B7B' as const;
/** Colour of the perimeter Easting/Northing numbering. */
export const TOPO_GRID_LABEL_COLOR = '#374151' as const;

/** Half-length of a cross arm, ON SCREEN (px) — the small «+» drawn at each grid intersection. */
export const TOPO_GRID_CROSS_SCREEN_PX = 6 as const;
/** Half-length of a cross arm, in the drawing (mm) — the baked export entity size. */
export const TOPO_GRID_CROSS_WORLD_MM = 400 as const;

/** Text height (mm) for the baked export coordinate labels. */
export const TOPO_GRID_LABEL_HEIGHT_MM = 250 as const;
/** Font (screen labels) — monospace so digits align, matching the rulers. */
export const TOPO_GRID_LABEL_FONT = '11px monospace' as const;
/** Decimal places for the metre-formatted coordinate labels (whole metres on round lines). */
export const TOPO_GRID_LABEL_DECIMALS = 0 as const;

/**
 * Survey step ladder in canonical mm (10 m … 2 km), the survey-appropriate 1-2-5 subset of
 * `RulerRenderer.ADAPTIVE_INTERVALS`. The screen consumer picks adaptively from this by zoom;
 * the export consumer uses a fixed chosen value (`GridDisplayOptions.exportStepM`).
 */
export const SURVEY_STEP_LADDER_MM: readonly number[] = [
  10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000,
] as const;

/** Target on-screen spacing (px) between adjacent grid lines — drives the adaptive step pick. */
export const TOPO_GRID_TARGET_SPACING_PX = 120 as const;

/** Default fixed step (metres) for the baked export grid — 100 m is the ΕΓΣΑ87 sheet convention. */
export const DEFAULT_EXPORT_STEP_M = 100 as const;

/**
 * WHAT the display store owns: whether the live screen graticule is shown, and the fixed step
 * (metres) the «Bake to drawing» export uses. The screen step is adaptive and NOT stored.
 */
export interface GridDisplayOptions {
  readonly visible: boolean;
  readonly exportStepM: number;
}

/** Default = graticule hidden (opt-in, like F7), 100 m export step. */
export const DEFAULT_GRID_DISPLAY_OPTS: GridDisplayOptions = {
  visible: false,
  exportStepM: DEFAULT_EXPORT_STEP_M,
};
