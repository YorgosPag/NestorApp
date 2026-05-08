/**
 * Overlay renderer — line shape draw.
 *
 * @module components/shared/files/media/overlay-renderer/line
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform } from './types';

export interface DrawLineStyle {
  stroke: string;
  lineWidth: number;
  dashed?: boolean;
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  start: Point2D,
  end: Point2D,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawLineStyle,
): void {
  const a = worldToScreen(start.x, start.y, bounds, fit);
  const b = worldToScreen(end.x, end.y, bounds, fit);

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  if (style.dashed) ctx.setLineDash([6, 4]);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  if (style.dashed) ctx.setLineDash([]);
}
