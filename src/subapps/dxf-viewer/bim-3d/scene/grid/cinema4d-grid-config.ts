/**
 * cinema4d-grid-config.ts — Cinema-4D-style 3D viewport ground grid (ADR-558).
 *
 * Colour SSoT:
 *  - major / minor grid colours are SHARED with the 2D grid through the design-tokens CSS
 *    vars `--canvas-grid-cinema4d-major` / `--canvas-grid-cinema4d-minor` (#414141 / #4B4B4B),
 *    resolved live via {@link resolveCssVarColor} so a theme switch moves 2D + 3D together.
 *  - axis / horizon colours are the C4D R15 dark-scheme VIEWCOLORS (source of truth:
 *    `…\\MAXON\\CINEMA 4D R15\\resource\\schemes\\Dark\\dark.col`, VIEWCOLORS section). They are
 *    not yet design tokens, so they live here as named constants citing that source.
 *
 * Dynamic model: per-fragment DECADE LOD (Blender / Maya / Ben Golus "pristine grid"). The shader
 * derives the line spacing from the screen-space derivative PER PIXEL, so the grid subdivides
 * continuously with zoom AND auto-coarsens toward the horizon under camera tilt — exactly the C4D
 * "Dynamic Grid 1..10" behaviour. (The 2D ortho single-scale cascade cannot express this; see ADR.)
 *
 * @module bim-3d/scene/grid/cinema4d-grid-config
 */

// ── Colours ──────────────────────────────────────────────────────────────────

/** Minor-grid colour — token `canvas.grid.cinema4d-minor` (#4B4B4B, VIEWCOLOR_GRID_MINOR 75,75,75). */
export const GRID3D_MINOR_COLOR_VAR = 'var(--canvas-grid-cinema4d-minor)';
export const GRID3D_MINOR_COLOR_FALLBACK = '#4B4B4B';
/** Major-grid colour — token `canvas.grid.cinema4d-major` (#414141, VIEWCOLOR_GRID_MAJOR 65,65,65).
 *  NOTE C4D: major is DARKER than minor; the visual weight comes from {@link GRID3D_MAJOR_LINE_PX}. */
export const GRID3D_MAJOR_COLOR_VAR = 'var(--canvas-grid-cinema4d-major)';
export const GRID3D_MAJOR_COLOR_FALLBACK = '#414141';

/** World X axis — VIEWCOLOR_XAXIS (229,45,45). */
export const GRID3D_AXIS_X_COLOR = '#E52D2D';
/** World Z axis (north = −Z) — VIEWCOLOR_ZAXIS (45,45,229). */
export const GRID3D_AXIS_Z_COLOR = '#2D2DE5';

// ── Geometry / decade LOD / fade (world metres unless noted) ──────────────────

/** Ground-plane half-size (m). Bounded but large; the distance fog dissolves it before the edge,
 *  and the mesh re-centres on the camera target each frame so the window always covers the view. */
export const GRID3D_PLANE_HALF_SIZE_M = 2000;

/** Decade anchor cell (m). The per-fragment LOD multiplies this by powers of ten, so the visible
 *  minor spacing is always a clean 1 / 10 / 100 … m (or 0.1 / 0.01 m when zoomed in). C4D decade model. */
export const GRID3D_BASE_CELL_M = 1;
/** Minor decade ratio — C4D "Major Lines Every nth" = 10 (major line every 10th minor). Decade grid. */
export const GRID3D_MAJOR_EVERY = 10;
/** Minimum on-screen px between the FINEST minor lines. The LOD keeps minor spacing in
 *  [MIN_CELL_PX, 10·MIN_CELL_PX); the next finer decade only cross-fades in once it too clears this
 *  gap → never a solid sheet. Tuned to C4D's "~5–15 lines across the window" target density
 *  (research: GetGridStep). Larger = sparser. */
export const GRID3D_MIN_CELL_PX = 64;

/** Line widths (screen px, derivative AA). C4D R15 draws ALL grid lines at 1px and distinguishes
 *  major from minor by COLOUR ONLY (verified: no thicker-major directive anywhere in the resources;
 *  #414141 major is darker than #4B4B4B minor on the grey background → reads as the heavier line).
 *  Axes get a hair more presence (different element, colour-keyed). */
export const GRID3D_MINOR_LINE_PX = 1.0;
export const GRID3D_MAJOR_LINE_PX = 1.0;
export const GRID3D_AXIS_LINE_PX = 1.2;

/** Finite grid extent as a multiple of the camera→target distance (d). C4D STOPS the grid at a hard
 *  boundary — it does NOT distance-fade toward the horizon (verified: GetGridStep's `fade` is the
 *  LOD-transition crossfade only, never a distance fade). Square half-size = K·d, tracking the view
 *  so the hard edge sits near the horizon at any zoom. Larger = the edge sits further out. */
export const GRID3D_EXTENT_K = 16;

/** Peak grid opacity (subtle, C4D-like — lines sit just above the grey studio background). */
export const GRID3D_MAX_OPACITY = 0.9;
