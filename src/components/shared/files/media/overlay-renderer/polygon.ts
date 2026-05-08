/**
 * Overlay renderer — polygon shape draw.
 *
 * Lowest-level draw helper. Caller resolves colors and passes the world-space
 * vertex array. Honors `closed` flag: closed polygons fill+stroke, open
 * polygons (used for `polyline`-style annotations) stroke only.
 *
 * @module components/shared/files/media/overlay-renderer/polygon
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform } from './types';

export interface DrawPolygonStyle {
  stroke: string;
  fill: string;
  lineWidth: number;
}

/**
 * Draw a polygon (or open polyline) in world space. Skips < 2 vertices.
 * Caller wraps `ctx.save()/restore()` if state isolation is desired.
 */
export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Point2D>,
  closed: boolean,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawPolygonStyle,
): void {
  if (vertices.length < 2) return;
  if (closed && vertices.length < 3) return;

  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;

  ctx.beginPath();
  vertices.forEach((vertex, i) => {
    const s = worldToScreen(vertex.x, vertex.y, bounds, fit);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });

  if (closed) {
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.stroke();
  }
}
