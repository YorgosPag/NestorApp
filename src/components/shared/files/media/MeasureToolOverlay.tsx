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
  drawMeasurement,
  rectBoundsToScene,
} from '@/components/shared/files/media/overlay-renderer';
import type { Point2D, SceneBounds } from '@/components/shared/files/media/overlay-renderer';
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
  className,
}: MeasureToolOverlayProps) {
  const { t } = useTranslation(['files-media']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point2D[]>([]);

  const effectiveBounds: SceneBounds | null =
    sceneBounds ?? (rasterSize ? rectBoundsToScene(rasterSize.width, rasterSize.height) : null);

  // Reset accumulated points whenever the active mode toggles.
  useEffect(() => {
    setPoints([]);
  }, [mode]);

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

  // Render current measurement onto the overlay canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!mode || !effectiveBounds || points.length === 0) return;

    const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);
    const { value, unit } = computeMeasurement(points, mode, unitsPerMeter ?? null, t);
    drawMeasurement(
      ctx,
      { points, mode, value, unit },
      effectiveBounds,
      fit,
      { stroke: STROKE_COLOR, lineWidth: STROKE_WIDTH },
    );
  }, [points, mode, effectiveBounds, zoom, panOffset, unitsPerMeter, t]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mode || !effectiveBounds) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);
      const world = screenToWorld(sx, sy, effectiveBounds, fit);
      setPoints((prev) => appendPoint(prev, world, mode));
    },
    [mode, effectiveBounds, zoom, panOffset],
  );

  if (!mode) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={cn('absolute inset-0 cursor-crosshair', className)}
      aria-label={t('floorplan.measure.toolbar')}
    />
  );
}

// ─── Helpers (pure, ≤40 LOC each) ─────────────────────────────────────────────

function appendPoint(prev: Point2D[], world: Point2D, mode: MeasureMode): Point2D[] {
  if (mode === 'distance' && prev.length >= 2) return [world];
  if (mode === 'angle' && prev.length >= 3) return [world];
  return [...prev, world];
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
      value: angleAtVertex(points[0], points[1], points[2]),
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
