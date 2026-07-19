/* eslint-disable design-system/no-hardcoded-colors */
/**
 * ENTERPRISE: measure-overlay-draw — pure canvas draw + measurement-math
 * helpers for `MeasureToolOverlay`.
 *
 * Extracted from the overlay component (N.7.1 file-size SRP) so the component
 * stays thin. Every export is a pure function (no React, no state). Reuses the
 * overlay-renderer SSoT (`drawMeasurement`, `worldToScreen`, `format*`) for
 * visual consistency with persisted overlays — no bespoke renderer.
 *
 * Bundle isolation: NO imports from `src/subapps/dxf-viewer/`.
 *
 * @module components/shared/files/media/measure-overlay-draw
 * @enterprise ADR-340 §3.6 / Phase 9 STEP J
 */

import {
  worldToScreen,
  drawMeasurement,
  formatDistance,
  formatArea,
  formatAngle,
} from '@/components/shared/files/media/overlay-renderer';
import type { Point2D, SceneBounds, FitTransform } from '@/components/shared/files/media/overlay-renderer';
import type { MeasureMode } from '@/components/shared/files/media/MeasureToolbar';
import type { LocalMeasurement } from '@/components/shared/files/media/local-measurements-store';

export const STROKE_COLOR = '#FF6B35';
export const STROKE_WIDTH = 2;
/** Screen-pixel radius within which clicking the first area vertex closes the polygon. */
export const CLOSE_POLYGON_TOLERANCE_PX = 12;

/** Pixel distance between two world points under the current fit transform. */
export function screenDistance(a: Point2D, b: Point2D, bounds: SceneBounds, fit: FitTransform): number {
  const sa = worldToScreen(a.x, a.y, bounds, fit);
  const sb = worldToScreen(b.x, b.y, bounds, fit);
  return Math.hypot(sa.x - sb.x, sa.y - sb.y);
}

/**
 * Area-close affordance: a hollow ring on the FIRST vertex signalling "click
 * here to close". Fills when the cursor is within closing tolerance (ArchiCAD /
 * Illustrator polygon-close cue).
 */
export function drawAreaCloseHandle(
  ctx: CanvasRenderingContext2D,
  firstWorld: Point2D,
  bounds: SceneBounds,
  fit: FitTransform,
  active: boolean,
): void {
  const s = worldToScreen(firstWorld.x, firstWorld.y, bounds, fit);
  ctx.save();
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
  if (active) {
    ctx.fillStyle = `${STROKE_COLOR}66`;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

/** Minimum points a mode needs before a measurement can be committed. */
export function minPointsForMode(mode: MeasureMode): number {
  return mode === 'distance' ? 2 : 3; // area + angle both need 3
}

/**
 * Drop consecutive duplicate points (within `eps`). A double-click finish
 * gesture fires two clicks at the same spot before `dblclick`; this keeps the
 * committed geometry clean.
 */
export function dedupeConsecutivePoints(points: ReadonlyArray<Point2D>, eps = 1e-6): Point2D[] {
  const out: Point2D[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > eps || Math.abs(last.y - p.y) > eps) out.push(p);
  }
  return out;
}

/**
 * AutoCAD OSNAP marker glyphs: ENDPOINT → square (□), MIDPOINT → triangle (△).
 * Any other snap kind falls back to the square. Drawn in the standard OSNAP amber.
 */
export function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  worldPt: Point2D,
  bounds: SceneBounds,
  fit: FitTransform,
  snapType?: string,
): void {
  const s = worldToScreen(worldPt.x, worldPt.y, bounds, fit);
  ctx.save();
  ctx.strokeStyle = '#FFCC00';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  if (isMidpointSnap(snapType)) {
    // Equilateral triangle centered on the snap point (AutoCAD «Μέσο»).
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r);
    ctx.lineTo(s.x - r * 0.87, s.y + r * 0.5);
    ctx.lineTo(s.x + r * 0.87, s.y + r * 0.5);
    ctx.closePath();
    ctx.stroke();
  } else {
    // Square (AutoCAD «Άκρο» / endpoint + fallback).
    const half = 5;
    ctx.strokeRect(s.x - half, s.y - half, half * 2, half * 2);
  }
  ctx.restore();
}

/** True for any midpoint-family snap kind (generic + BIM + complex-linetype). */
export function isMidpointSnap(snapType?: string): boolean {
  return snapType === 'midpoint' || snapType === 'bim_midpoint' || snapType === 'complex_midpoint';
}

/** Solid 3px vertex dots in STROKE_COLOR (SSoT for the measure-tool vertex marks). */
function drawVertexDots(ctx: CanvasRenderingContext2D, screen: ReadonlyArray<{ x: number; y: number }>): void {
  ctx.fillStyle = STROKE_COLOR;
  for (const s of screen) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawConfirmedAngleRay(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point2D>,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const screen = points.map((p) => worldToScreen(p.x, p.y, bounds, fit));
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(screen[0].x, screen[0].y);
  ctx.lineTo(screen[1].x, screen[1].y);
  ctx.stroke();
  drawVertexDots(ctx, screen);
}

export function drawAngleMeasurement(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point2D>,
  bounds: SceneBounds,
  fit: FitTransform,
  angleDeg: number,
): void {
  // points[0]=ray1Start, points[1]=vertex, points[2]=ray2End
  const screen = points.map((p) => worldToScreen(p.x, p.y, bounds, fit));
  const v = screen[1];

  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(screen[0].x, screen[0].y);
  ctx.lineTo(v.x, v.y);
  ctx.lineTo(screen[2].x, screen[2].y);
  ctx.stroke();

  drawVertexDots(ctx, screen);

  const a1 = Math.atan2(screen[0].y - v.y, screen[0].x - v.x);
  const a2 = Math.atan2(screen[2].y - v.y, screen[2].x - v.x);
  const r1 = Math.hypot(screen[0].x - v.x, screen[0].y - v.y);
  const r2 = Math.hypot(screen[2].x - v.x, screen[2].y - v.y);
  const arcR = Math.max(16, Math.min(40, Math.min(r1, r2) * 0.3));

  // Normalize to [-π, π] → shorter arc, correct direction
  let da = a2 - a1;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;

  ctx.save();
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(v.x, v.y, arcR, a1, a2, da < 0);
  ctx.stroke();
  ctx.restore();

  const aMid = a1 + da / 2;
  const labelR = arcR + 14;
  const lx = v.x + Math.cos(aMid) * labelR;
  const ly = v.y + Math.sin(aMid) * labelR;
  const label = formatAngle(angleDeg);
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeText(label, lx, ly);
  ctx.fillText(label, lx, ly);
}

export function appendPoint(prev: Point2D[], world: Point2D, mode: MeasureMode): Point2D[] {
  if (mode === 'angle' && prev.length >= 3) return prev;
  return [...prev, world];
}

/**
 * Draw dashed rubber band from last confirmed point to cursor + cursor dot +
 * preview measurement label. For angle mode with 2 pts, draws second ray from
 * vertex (points[1]), not from ray1 start.
 */
export function drawRubberBand(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point2D>,
  cursor: Point2D,
  mode: MeasureMode,
  bounds: SceneBounds,
  fit: FitTransform,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): void {
  const fromPt = mode === 'angle' && points.length === 2 ? points[1] : points[points.length - 1];
  const from = worldToScreen(fromPt.x, fromPt.y, bounds, fit);
  const to = worldToScreen(cursor.x, cursor.y, bounds, fit);

  ctx.save();
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = STROKE_COLOR;
  ctx.beginPath();
  ctx.arc(to.x, to.y, 4, 0, Math.PI * 2);
  ctx.fill();

  const previewPts: Point2D[] = mode === 'angle' && points.length === 2
    ? [points[0], points[1], cursor]
    : [...points, cursor];
  const { value, unit } = computeMeasurement(previewPts, mode, unitsPerMeter, t);
  if (value > 0) {
    const label = mode === 'angle' ? formatAngle(value)
      : mode === 'area' ? formatArea(value, unit)
      : formatDistance(value, unit);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 14 };
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, mid.x, mid.y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, mid.x, mid.y);
  }
}

export function drawSegmentLabels(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Point2D>,
  bounds: SceneBounds,
  fit: FitTransform,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): void {
  for (let i = 1; i < points.length; i++) {
    const a = worldToScreen(points[i - 1].x, points[i - 1].y, bounds, fit);
    const b = worldToScreen(points[i].x, points[i].y, bounds, fit);
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const { value, unit } = convertDistance(Math.sqrt(dx * dx + dy * dy), unitsPerMeter, t);
    const label = formatDistance(value, unit);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 10 };
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label, mid.x, mid.y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, mid.x, mid.y);
  }
}

/**
 * Draw ONE accumulated (committed) measurement. Distance/area reuse the
 * overlay-renderer `drawMeasurement` SSoT; angle reuses `drawAngleMeasurement`.
 * The stored `value`/`unit` win (no recompute), matching the persisted-overlay
 * contract.
 */
export function drawCommittedMeasurement(
  ctx: CanvasRenderingContext2D,
  m: LocalMeasurement,
  bounds: SceneBounds,
  fit: FitTransform,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): void {
  if (m.mode === 'angle') {
    if (m.points.length >= 3) drawAngleMeasurement(ctx, m.points, bounds, fit, m.value);
    return;
  }
  drawMeasurement(
    ctx,
    { points: m.points, mode: m.mode, value: m.value, unit: m.unit },
    bounds,
    fit,
    { stroke: STROKE_COLOR, lineWidth: STROKE_WIDTH },
  );
  if (m.mode === 'distance') drawSegmentLabels(ctx, m.points, bounds, fit, unitsPerMeter, t);
}

// ─── Measurement math (pure) ──────────────────────────────────────────────────

export function computeMeasurement(
  points: ReadonlyArray<Point2D>,
  mode: MeasureMode,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): { value: number; unit: string } {
  if (mode === 'angle') {
    if (points.length < 3) return { value: 0, unit: t('floorplan.measure.unitDegree') };
    return {
      value: angleAtVertex(points[1], points[0], points[2]),
      unit: t('floorplan.measure.unitDegree'),
    };
  }
  if (mode === 'distance') {
    return convertDistance(polylineLength(points), unitsPerMeter, t);
  }
  return convertArea(polygonArea(points), unitsPerMeter, t);
}

function convertWithUnit(
  native: number,
  unitsPerMeter: number | null,
  divisor: (upm: number) => number,
  unitKey: string,
  t: (key: string) => string,
): { value: number; unit: string } {
  if (!unitsPerMeter || unitsPerMeter <= 0) {
    return { value: native, unit: t('floorplan.measure.unitPixel') };
  }
  return { value: native / divisor(unitsPerMeter), unit: t(unitKey) };
}

export function convertDistance(
  native: number,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): { value: number; unit: string } {
  return convertWithUnit(native, unitsPerMeter, (upm) => upm, 'floorplan.measure.unitMeter', t);
}

export function convertArea(
  native: number,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): { value: number; unit: string } {
  return convertWithUnit(
    native,
    unitsPerMeter,
    (upm) => upm * upm,
    'floorplan.measure.unitSquareMeter',
    t,
  );
}

export function polylineLength(points: ReadonlyArray<Point2D>): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum;
}

export function polygonArea(points: ReadonlyArray<Point2D>): number {
  if (points.length < 3) return 0;
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    acc += a.x * b.y - b.x * a.y;
  }
  return Math.abs(acc) / 2;
}

export function angleAtVertex(vertex: Point2D, a: Point2D, b: Point2D): number {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = b.x - vertex.x;
  const v2y = b.y - vertex.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
