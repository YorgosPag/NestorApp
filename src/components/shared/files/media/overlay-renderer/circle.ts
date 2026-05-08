/**
 * Overlay renderer — circle shape draw.
 *
 * Radius is in world units; multiplied by `fit.scale` for canvas. v1
 * limitation: assumes uniform scale (renderer always supplies uniform scale).
 *
 * @module components/shared/files/media/overlay-renderer/circle
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform } from './types';

export interface DrawCircleStyle {
  stroke: string;
  fill?: string;
  lineWidth: number;
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawCircleStyle,
): void {
  if (!Number.isFinite(radius) || radius <= 0) return;

  const c = worldToScreen(center.x, center.y, bounds, fit);
  const r = radius * fit.scale;

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2, false);
  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  ctx.stroke();
}
