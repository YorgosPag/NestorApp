/* eslint-disable design-system/no-hardcoded-colors */
/**
 * Overlay renderer — dimension shape draw.
 *
 * Renders two extension lines + dimension line with arrowheads + center
 * label showing real-world distance. `unitsPerMeter` (from `BackgroundScale`)
 * converts world units → meters for the label.
 *
 * @module components/shared/files/media/overlay-renderer/dimension
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import { formatDistance } from './format-utils';
import type { Point2D, SceneBounds, FitTransform } from './types';

const ARROW_SIZE_PX = 8;
const LABEL_FONT = '12px system-ui, sans-serif';

export interface DrawDimensionStyle {
  stroke: string;
  lineWidth: number;
}

export interface DimensionInput {
  from: Point2D;
  to: Point2D;
  value?: string;
  unit?: string;
}

export function drawDimension(
  ctx: CanvasRenderingContext2D,
  input: DimensionInput,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawDimensionStyle,
  unitsPerMeter?: number,
): void {
  const a = worldToScreen(input.from.x, input.from.y, bounds, fit);
  const b = worldToScreen(input.to.x, input.to.y, bounds, fit);

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  drawArrowhead(ctx, b, a, style.stroke);
  drawArrowhead(ctx, a, b, style.stroke);

  const label = resolveLabel(input, unitsPerMeter);
  if (label) drawLabelAtMidpoint(ctx, a, b, label);
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  from: { x: number; y: number },
  color: string,
): void {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * ARROW_SIZE_PX + px * (ARROW_SIZE_PX / 2),
             tip.y - uy * ARROW_SIZE_PX + py * (ARROW_SIZE_PX / 2));
  ctx.lineTo(tip.x - ux * ARROW_SIZE_PX - px * (ARROW_SIZE_PX / 2),
             tip.y - uy * ARROW_SIZE_PX - py * (ARROW_SIZE_PX / 2));
  ctx.closePath();
  ctx.fill();
}

function resolveLabel(input: DimensionInput, unitsPerMeter?: number): string | null {
  if (input.value) return input.value;
  if (!unitsPerMeter || unitsPerMeter <= 0) return null;
  const dxw = input.to.x - input.from.x;
  const dyw = input.to.y - input.from.y;
  const meters = Math.hypot(dxw, dyw) / unitsPerMeter;
  return formatDistance(meters, input.unit ?? 'm');
}

function drawLabelAtMidpoint(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  text: string,
): void {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeText(text, mx, my - 8);
  ctx.fillText(text, mx, my - 8);
}
