/**
 * ENTERPRISE: MeasureToolOverlay — transient client-side measure canvas.
 *
 * Transparent canvas overlay layered above FloorplanGallery's main canvas.
 * Modes: `distance` (2 clicks polyline), `area` (≥3 clicks closed polygon),
 * `angle` (3 clicks: vertex first, then 2 rays). ESC + mode change clear.
 *
 * Local React state ONLY — never writes Firestore, never imports the
 * floorplan-overlay-mutation-gateway. Bundle isolation: NO imports from
 * `src/subapps/dxf-viewer/`.
 *
 * Reuses `drawMeasurement` from the overlay-renderer SSoT for visual
 * consistency with persisted measurement overlays.
 *
 * @module components/shared/files/media/MeasureToolOverlay
 * @enterprise ADR-340 §3.6 / Phase 9 STEP H
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PanOffset } from '@/hooks/useZoomPan';
import {
  computeFitTransform,
  screenToWorld,
  worldToScreen,
  drawMeasurement,
  rectBoundsToScene,
  formatDistance,
  formatArea,
  formatAngle,
} from '@/components/shared/files/media/overlay-renderer';
import type { Point2D, SceneBounds, FitTransform } from '@/components/shared/files/media/overlay-renderer';
import type { MeasureMode } from '@/components/shared/files/media/MeasureToolbar';

const STROKE_COLOR = '#FF6B35';
const STROKE_WIDTH = 2;

export interface MeasureToolOverlayProps {
  /** Active mode; `null` hides the overlay entirely. */
  mode: MeasureMode | null;
  /** World-space scene bounds (DXF) OR pass `null` and provide `rasterSize`. */
  sceneBounds: SceneBounds | null;
  /** Raster background dimensions (px). Used when `sceneBounds` is null. */
  rasterSize?: { width: number; height: number } | null;
  /** Current zoom level from `useZoomPan`. */
  zoom: number;
  /** Current pan offset from `useZoomPan`. */
  panOffset: PanOffset;
  /**
   * Native units per real-world meter. When provided, distances/areas are
   * displayed in meters; otherwise the unit falls back to native pixels.
   */
  unitsPerMeter?: number | null;
  /**
   * Optional snap resolver (DXF mode only). Given a world-space cursor point,
   * returns the nearest ENDPOINT snap point or null if no snap within tolerance.
   * Provided by FloorplanGallery via the global snap engine — never mutates
   * engine settings; filters ENDPOINT client-side on the result.
   */
  findSnapPoint?: (worldPt: Point2D) => Point2D | null;
  /** Optional className passthrough for absolute layout customization. */
  className?: string;
}

export function MeasureToolOverlay({
  mode,
  sceneBounds,
  rasterSize,
  zoom,
  panOffset,
  unitsPerMeter,
  findSnapPoint,
  className,
}: MeasureToolOverlayProps) {
  const { t } = useTranslation(['files-media']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point2D[]>([]);
  // cursor.pos = effective world position (snapped or raw), cursor.snapped = shows indicator
  const [cursor, setCursor] = useState<{ pos: Point2D; snapped: boolean } | null>(null);
  const angleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so handlers always read latest findSnapPoint without being in deps
  const findSnapPointRef = useRef(findSnapPoint);
  findSnapPointRef.current = findSnapPoint;

  const effectiveBounds: SceneBounds | null =
    sceneBounds ?? (rasterSize ? rectBoundsToScene(rasterSize.width, rasterSize.height) : null);

  // Reset accumulated points whenever the active mode toggles.
  useEffect(() => {
    if (angleTimerRef.current) clearTimeout(angleTimerRef.current);
    setPoints([]);
    setCursor(null);
  }, [mode]);

  // After angle 3rd click: show result 10s then auto-clear.
  useEffect(() => {
    if (mode !== 'angle' || points.length !== 3) return;
    angleTimerRef.current = setTimeout(() => setPoints([]), 10_000);
    return () => {
      if (angleTimerRef.current) clearTimeout(angleTimerRef.current);
    };
  }, [mode, points.length]);

  // ESC clears (only when a mode is active).
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPoints([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // Sync canvas internal pixel buffer to its container size.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const sync = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Render confirmed measurement + rubber band to cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!mode || !effectiveBounds || points.length === 0) return;

    const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);

    if (points.length >= 2) {
      if (mode === 'angle') {
        if (points.length >= 3) {
          const { value } = computeMeasurement(points, mode, unitsPerMeter ?? null, t);
          drawAngleMeasurement(ctx, points, effectiveBounds, fit, value);
        } else {
          // First ray confirmed — draw line + ticks, no label yet
          drawConfirmedAngleRay(ctx, points, effectiveBounds, fit);
        }
      } else {
        const { value, unit } = computeMeasurement(points, mode, unitsPerMeter ?? null, t);
        drawMeasurement(
          ctx,
          { points, mode, value, unit },
          effectiveBounds,
          fit,
          { stroke: STROKE_COLOR, lineWidth: STROKE_WIDTH },
        );
        if (mode === 'distance') {
          drawSegmentLabels(ctx, points, effectiveBounds, fit, unitsPerMeter ?? null, t);
        }
      }
    } else {
      // Single confirmed point — drawMeasurement skips it; render marker manually.
      const s = worldToScreen(points[0].x, points[0].y, effectiveBounds, fit);
      ctx.fillStyle = STROKE_COLOR;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cursor) {
      drawRubberBand(ctx, points, cursor.pos, mode, effectiveBounds, fit, unitsPerMeter ?? null, t);
      if (cursor.snapped) drawSnapIndicator(ctx, cursor.pos, effectiveBounds, fit);
    }
  }, [points, cursor, mode, effectiveBounds, zoom, panOffset, unitsPerMeter, t]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mode || !effectiveBounds) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);
      const world = screenToWorld(sx, sy, effectiveBounds, fit);
      const snapped = findSnapPointRef.current?.(world) ?? world;
      setPoints((prev) => appendPoint(prev, snapped, mode));
    },
    [mode, effectiveBounds, zoom, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mode || !effectiveBounds) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);
      const world = screenToWorld(sx, sy, effectiveBounds, fit);
      const snappedPt = findSnapPointRef.current?.(world);
      setCursor({ pos: snappedPt ?? world, snapped: snappedPt !== null && snappedPt !== undefined });
    },
    [mode, effectiveBounds, zoom, panOffset],
  );

  const handleMouseLeave = useCallback(() => setCursor(null), []);

  if (!mode) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('absolute inset-0 cursor-crosshair', className)}
      aria-label={t('floorplan.measure.toolbar')}
    />
  );
}

// ─── Helpers (pure, ≤40 LOC each) ─────────────────────────────────────────────

function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  worldPt: Point2D,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const s = worldToScreen(worldPt.x, worldPt.y, bounds, fit);
  const half = 5;
  ctx.save();
  ctx.strokeStyle = '#FFCC00';
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - half, s.y - half, half * 2, half * 2);
  ctx.restore();
}

function drawConfirmedAngleRay(
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
  ctx.fillStyle = STROKE_COLOR;
  for (const s of screen) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAngleMeasurement(
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

  ctx.fillStyle = STROKE_COLOR;
  for (const s of screen) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

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

function appendPoint(prev: Point2D[], world: Point2D, mode: MeasureMode): Point2D[] {
  if (mode === 'angle' && prev.length >= 3) return prev;
  return [...prev, world];
}

/**
 * Draw dashed rubber band from last confirmed point to cursor + cursor dot +
 * preview measurement label. For angle mode with 2 pts, draws second ray from
 * vertex (points[1]), not from ray1 start.
 */
function drawRubberBand(
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

function drawSegmentLabels(
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

function computeMeasurement(
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
    const native = polylineLength(points);
    return convertDistance(native, unitsPerMeter, t);
  }
  // area
  const native = polygonArea(points);
  return convertArea(native, unitsPerMeter, t);
}

function convertDistance(
  native: number,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): { value: number; unit: string } {
  if (!unitsPerMeter || unitsPerMeter <= 0) {
    return { value: native, unit: t('floorplan.measure.unitPixel') };
  }
  return { value: native / unitsPerMeter, unit: t('floorplan.measure.unitMeter') };
}

function convertArea(
  native: number,
  unitsPerMeter: number | null,
  t: (key: string) => string,
): { value: number; unit: string } {
  if (!unitsPerMeter || unitsPerMeter <= 0) {
    return { value: native, unit: t('floorplan.measure.unitPixel') };
  }
  return {
    value: native / (unitsPerMeter * unitsPerMeter),
    unit: t('floorplan.measure.unitSquareMeter'),
  };
}

function polylineLength(points: ReadonlyArray<Point2D>): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum;
}

function polygonArea(points: ReadonlyArray<Point2D>): number {
  if (points.length < 3) return 0;
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    acc += a.x * b.y - b.x * a.y;
  }
  return Math.abs(acc) / 2;
}

function angleAtVertex(vertex: Point2D, a: Point2D, b: Point2D): number {
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

export default MeasureToolOverlay;
