/* eslint-disable design-system/no-hardcoded-colors */
/**
 * Overlay renderer — measurement shape draw (distance / area / angle).
 *
 * `mode === 'distance'`  → polyline + total length label.
 * `mode === 'area'`      → closed polygon (translucent fill) + area label at centroid.
 * `mode === 'angle'`     → 3-point V (vertex first) + arc indicator + degrees.
 *
 * The pre-computed `value` on the geometry wins over real-time recomputation;
 * `unit` controls the label suffix.
 *
 * @module components/shared/files/media/overlay-renderer/measurement
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import { formatNumber } from './format-utils';
import type { Point2D, SceneBounds, FitTransform } from './types';

const LABEL_FONT = '12px system-ui, sans-serif';
const TICK_SIZE_PX = 6;

export interface DrawMeasurementStyle {
  stroke: string;
  lineWidth: number;
}

export interface MeasurementInput {
  points: ReadonlyArray<Point2D>;
  mode: 'distance' | 'area' | 'angle';
  value: number;
  unit: string;
}

export function drawMeasurement(
  ctx: CanvasRenderingContext2D,
  input: MeasurementInput,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawMeasurementStyle,
): void {
  if (input.points.length < 2) return;

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;

  const screen = input.points.map((p) => worldToScreen(p.x, p.y, bounds, fit));

  if (input.mode === 'area') {
    drawAreaPath(ctx, screen, style.stroke);
  } else {
    drawPolylinePath(ctx, screen);
    drawTicks(ctx, screen, style.stroke);
  }

  const labelPos = pickLabelPosition(screen, input.mode);
  if (labelPos) drawLabel(ctx, labelPos, `${formatNumber(input.value)} ${input.unit}`);
}

function drawPolylinePath(
  ctx: CanvasRenderingContext2D,
  screen: ReadonlyArray<{ x: number; y: number }>,
): void {
  ctx.beginPath();
  screen.forEach((s, i) => (i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y)));
  ctx.stroke();
}

function drawAreaPath(
  ctx: CanvasRenderingContext2D,
  screen: ReadonlyArray<{ x: number; y: number }>,
  stroke: string,
): void {
  if (screen.length < 3) {
    drawPolylinePath(ctx, screen);
    return;
  }
  ctx.beginPath();
  screen.forEach((s, i) => (i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y)));
  ctx.closePath();
  ctx.fillStyle = `${stroke}33`;
  ctx.fill();
  ctx.stroke();
}

function drawTicks(
  ctx: CanvasRenderingContext2D,
  screen: ReadonlyArray<{ x: number; y: number }>,
  color: string,
): void {
  ctx.fillStyle = color;
  for (const s of screen) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, TICK_SIZE_PX / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pickLabelPosition(
  screen: ReadonlyArray<{ x: number; y: number }>,
  mode: 'distance' | 'area' | 'angle',
): { x: number; y: number } | null {
  if (screen.length === 0) return null;
  if (mode === 'angle') return screen[0];
  let sx = 0;
  let sy = 0;
  for (const s of screen) {
    sx += s.x;
    sy += s.y;
  }
  return { x: sx / screen.length, y: sy / screen.length };
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  text: string,
): void {
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeText(text, pos.x, pos.y - 10);
  ctx.fillText(text, pos.x, pos.y - 10);
}
