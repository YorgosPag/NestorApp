/**
 * hud-render-mode — ADR-366 §B.5.U (unified 2D + 3D Performance HUD)
 *
 * Canonical render-mode for the unified Performance HUD. Mirrors `ViewMode3D`
 * ('2d' | '3d-raster' | '3d-preview' | '3d-final') but is declared here, in the
 * performance layer, as a dependency-free leaf type so the performance modules
 * never import the `ViewMode3DStore` (avoids a store → performance import cycle).
 *
 * The mode bridge (`usePerformanceModeBridge`) keeps this in sync with
 * `ViewMode3DStore.mode`. In '2d' the WebGL-only metrics (triangles, drawCalls,
 * GPU memory, …) are reported as null by the 2D collector.
 */

export type HudRenderMode = '2d' | '3d-raster' | '3d-preview' | '3d-final';
