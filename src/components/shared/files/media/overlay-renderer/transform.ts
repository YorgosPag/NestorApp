/**
 * Overlay renderer — coordinate transform (Y-UP CAD convention).
 *
 * `worldToScreen` flips Y via `bounds.max.y - vy` so polygons authored in
 * the DXF Viewer editor (Y-UP) draw correctly on canvas (Y-DOWN). The
 * inverse `screenToWorld` is used by hit-tests and click-to-calibrate.
 *
 * @module components/shared/files/media/overlay-renderer/transform
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import type { SceneBounds, FitTransform } from './types';

/**
 * Compute aspect-fit + center transform for any rectangular bounds.
 * Mirrors the math used by `renderDxfToCanvas` and the raster renderer.
 */
export function computeFitTransform(
  canvasW: number,
  canvasH: number,
  bounds: SceneBounds,
  zoom: number = 1,
  pan: PanOffset = { x: 0, y: 0 },
): FitTransform {
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvasW / drawingWidth, canvasH / drawingHeight);
  const scale = baseScale * zoom;
  return {
    scale,
    offsetX: (canvasW - drawingWidth * scale) / 2 + pan.x,
    offsetY: (canvasH - drawingHeight * scale) / 2 + pan.y,
  };
}

/** Build a `SceneBounds` for a raster source whose origin is `(0, 0)`. */
export function rectBoundsToScene(width: number, height: number): SceneBounds {
  return { min: { x: 0, y: 0 }, max: { x: width, y: height } };
}

/** World vertex → canvas pixel (Y is flipped against `bounds.max.y`). */
export function worldToScreen(
  vx: number,
  vy: number,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } {
  return {
    x: (vx - bounds.min.x) * fit.scale + fit.offsetX,
    y: (bounds.max.y - vy) * fit.scale + fit.offsetY,
  };
}

/** Canvas pixel → world vertex (inverse of `worldToScreen`). */
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
