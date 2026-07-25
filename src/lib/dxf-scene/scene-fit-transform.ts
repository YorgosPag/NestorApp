/**
 * =============================================================================
 * SSoT: DXF scene → canvas fit transform + world→screen projection
 * =============================================================================
 *
 * ONE owner of the «aspect-fit a Y-UP CAD drawing into a Y-DOWN raster viewport»
 * math. Every surface that paints a parsed DXF scene (gallery canvas, upload
 * thumbnail, BIM read-only overlay bridge, project floorplan tab, overlay
 * renderer) resolves pixels through this module — so the geometry pass, the
 * overlay pass and the thumbnail can never drift apart by a pixel.
 *
 * Canonical formulas (do NOT re-inline them anywhere):
 *   fitW      = canvasW * (1 - 2 * paddingRatio)
 *   baseScale = min(fitW / drawingW, fitH / drawingH)
 *   scale     = baseScale * zoom
 *   offsetX   = (canvasW - drawingW * scale) / 2 + pan.x
 *   offsetY   = (canvasH - drawingH * scale) / 2 + pan.y
 *   screenX   = (worldX - bounds.min.x) * scale + offsetX
 *   screenY   = (bounds.max.y - worldY) * scale + offsetY   ← Y flip
 *
 * WHY it lives in `src/lib/` and not next to a consumer: the callers span
 * `components/` (gallery, project tab), `services/` (thumbnail generator) and
 * `subapps/` bridges. A neutral, dependency-free home is the only one all three
 * may import without a layering violation — same call as `lib/state/createExternalStore`.
 *
 * NOT covered here: `services/dxf-raster/svg-from-dxf-scene.ts`. That serializer
 * is deliberately dependency-free because it is mirrored byte-for-byte into
 * `functions/src/shared/` (Firebase deploys `functions/lib/**`, which cannot
 * resolve the Next.js tree). Its copy of these formulas is a documented
 * deployment mirror, not a violation.
 *
 * @module lib/dxf-scene/scene-fit-transform
 * @enterprise ADR-033 (Floorplan Processing), ADR-340 (Overlays), ADR-370 (Read-only render)
 */

/** Plain 2D vector — structural, so `PanOffset` and `Point2D` both satisfy it. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned world-space bounds of the source scene (Y-UP, CAD convention). */
export interface SceneBounds {
  readonly min: Vec2;
  readonly max: Vec2;
}

/** World→screen affine transform (uniform scale + offset). */
export interface FitTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

const ZERO_PAN: Vec2 = { x: 0, y: 0 };

/**
 * Degenerate-extent floor. A zero-width/height drawing would otherwise produce
 * `Infinity` scale and poison every downstream `ctx.arc()` / `ctx.moveTo()` call
 * with non-finite arguments. For any real drawing `max(EPSILON, d) === d`, so
 * this guard is behaviour-neutral on the normal path.
 */
const EXTENT_EPSILON = 1e-9;

/**
 * Compute the aspect-fit + centering transform for a scene inside a raster viewport.
 *
 * @param canvasW      viewport width in device-independent pixels
 * @param canvasH      viewport height in device-independent pixels
 * @param bounds       world-space extents of the drawing
 * @param zoom         user zoom multiplier applied on top of the base fit (default 1)
 * @param pan          user pan offset in pixels (default {0,0})
 * @param paddingRatio margin kept on EVERY side as a fraction of the viewport
 *                     (default 0 = edge-to-edge; 0.05 = the 5% thumbnail margin)
 */
export function computeFitTransform(
  canvasW: number,
  canvasH: number,
  bounds: SceneBounds,
  zoom: number = 1,
  pan: Vec2 = ZERO_PAN,
  paddingRatio: number = 0,
): FitTransform {
  const drawingWidth = Math.max(EXTENT_EPSILON, bounds.max.x - bounds.min.x);
  const drawingHeight = Math.max(EXTENT_EPSILON, bounds.max.y - bounds.min.y);

  const fitWidth = canvasW * (1 - 2 * paddingRatio);
  const fitHeight = canvasH * (1 - 2 * paddingRatio);

  const baseScale = Math.min(fitWidth / drawingWidth, fitHeight / drawingHeight);
  const scale = baseScale * zoom;

  return {
    scale,
    offsetX: (canvasW - drawingWidth * scale) / 2 + pan.x,
    offsetY: (canvasH - drawingHeight * scale) / 2 + pan.y,
  };
}

/** World X → canvas pixel X. Allocation-free scalar form for hot render loops. */
export function projectX(worldX: number, bounds: SceneBounds, fit: FitTransform): number {
  return (worldX - bounds.min.x) * fit.scale + fit.offsetX;
}

/** World Y → canvas pixel Y (flipped against `bounds.max.y`). Allocation-free. */
export function projectY(worldY: number, bounds: SceneBounds, fit: FitTransform): number {
  return (bounds.max.y - worldY) * fit.scale + fit.offsetY;
}

/** World vertex → canvas pixel. Object form, for callers that need a point. */
export function worldToScreen(
  vx: number,
  vy: number,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } {
  return { x: projectX(vx, bounds, fit), y: projectY(vy, bounds, fit) };
}

/** Canvas pixel → world vertex (exact inverse of {@link worldToScreen}). */
export function screenToWorld(
  sx: number,
  sy: number,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } {
  return {
    x: (sx - fit.offsetX) / fit.scale + bounds.min.x,
    y: bounds.max.y - (sy - fit.offsetY) / fit.scale,
  };
}

/** Build a `SceneBounds` for a raster source whose origin is `(0, 0)`. */
export function rectBoundsToScene(width: number, height: number): SceneBounds {
  return { min: { x: 0, y: 0 }, max: { x: width, y: height } };
}
