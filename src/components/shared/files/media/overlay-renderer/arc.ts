/**
 * Overlay renderer — arc shape draw.
 *
 * Arc angles are stored in world space measured CCW from +X (math standard).
 * The world→screen transform flips Y, so canvas needs:
 *   - negated start/end angles
 *   - swapped CCW flag (CCW in world = CW in canvas)
 * See ADR-340 Phase 9 STEP E plan §1.4 for derivation.
 *
 * @module components/shared/files/media/overlay-renderer/arc
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform } from './types';

export interface DrawArcStyle {
  stroke: string;
  lineWidth: number;
}

export function drawArc(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawArcStyle,
): void {
  if (!Number.isFinite(radius) || radius <= 0) return;

  const c = worldToScreen(center.x, center.y, bounds, fit);
  const r = radius * fit.scale;

  // Y-flip ⇒ negate angles + swap CCW flag.
  const canvasStart = -startAngle;
  const canvasEnd = -endAngle;
  const canvasCcw = !counterclockwise;

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, canvasStart, canvasEnd, canvasCcw);
  ctx.stroke();
}
