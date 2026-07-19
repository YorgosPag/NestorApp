/**
 * ENTERPRISE: MeasureToolOverlay — transient client-side measure canvas with
 * an ACCUMULATING local annotation layer.
 *
 * Transparent canvas overlay layered above FloorplanGallery's main canvas.
 * Modes: `distance` (polyline), `area` (closed polygon), `angle` (3 clicks:
 * vertex-first + 2 rays).
 *
 * Accumulation (Phase 9 STEP J): committed measurements pile up and stay drawn.
 * Finish the in-progress one with Enter / double-click (distance + area); angle
 * auto-commits on its 3rd click. ESC cancels the in-progress one. «Clear all»
 * (MeasureToolbar) wipes them via the shared `useLocalMeasurements` scope.
 *
 * Local state ONLY — never writes Firestore, never imports the
 * floorplan-overlay-mutation-gateway. Bundle isolation: NO imports from
 * `src/subapps/dxf-viewer/`. Draw + math helpers live in `measure-overlay-draw`.
 *
 * @module components/shared/files/media/MeasureToolOverlay
 * @enterprise ADR-340 §3.6 / Phase 9 STEP J
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
} from '@/components/shared/files/media/overlay-renderer';
import type { Point2D, SceneBounds, FitTransform } from '@/components/shared/files/media/overlay-renderer';
import type { MeasureMode } from '@/components/shared/files/media/MeasureToolbar';
import { useLocalMeasurements } from '@/components/shared/files/media/useLocalMeasurements';
import {
  STROKE_COLOR,
  STROKE_WIDTH,
  CLOSE_POLYGON_TOLERANCE_PX,
  minPointsForMode,
  dedupeConsecutivePoints,
  appendPoint,
  computeMeasurement,
  screenDistance,
  drawCommittedMeasurement,
  drawConfirmedAngleRay,
  drawAngleMeasurement,
  drawAreaCloseHandle,
  drawRubberBand,
  drawSegmentLabels,
  drawSnapIndicator,
} from '@/components/shared/files/media/measure-overlay-draw';
// TYPE-ONLY import (erased at compile) — keeps the overlay decoupled from the dxf-viewer
// subapp while sharing the snap-result contract owned by the bridge (N.18: one type, no clone).
import type { MeasureSnapPoint } from '@/components/shared/files/media/measure-snap-bridge';

/**
 * Fallback scale for an UNCALIBRATED DXF. The DXF import canonicalizes every scene to
 * MILLIMETERS (canonical-mm SSoT — `reference_dxf_units_and_viewport_ssot`), so 1 m = 1000
 * drawing units. Confirmed by measurement: 25 cm (= 250 mm) read as "0.25 m" with this divisor.
 * Lets measurements read in meters even before the user calibrates; any real calibration
 * (`unitsPerMeter` prop) always overrides this.
 */
const DXF_ASSUMED_UNITS_PER_METER = 1000;

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
   * Floorplan scope key for the accumulating local measurements store. Keeps
   * drawing A's measurements off drawing B's coordinate space when the gallery
   * switches files. `null` → shared default scope.
   */
  scopeKey?: string | null;
  /**
   * Optional snap resolver (DXF mode only). Given a world-space cursor point and the
   * REAL world→screen scale (`FitTransform.scale`), returns the nearest ENDPOINT/MIDPOINT
   * snap (point + kind) or null if none is within tolerance. Provided by FloorplanGallery
   * via a dedicated ProSnapEngineV2 instance (`measure-snap-bridge`). The `type` drives the
   * OSNAP glyph (□/△). Passing the scale (not bare zoom) is REQUIRED — see the bridge note.
   */
  findSnapPoint?: (worldPt: Point2D, screenScale: number) => MeasureSnapPoint | null;
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
  scopeKey,
  findSnapPoint,
  className,
}: MeasureToolOverlayProps) {
  const { t } = useTranslation(['files-media']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point2D[]>([]);
  // cursor.pos = effective world position (snapped or raw), cursor.snapped = shows indicator,
  // cursor.snapType = OSNAP kind ('endpoint' | 'midpoint' | …) that selects the marker glyph.
  const [cursor, setCursor] = useState<{ pos: Point2D; snapped: boolean; snapType?: string } | null>(null);
  // Ref so handlers always read latest findSnapPoint without being in deps
  const findSnapPointRef = useRef(findSnapPoint);
  findSnapPointRef.current = findSnapPoint;
  // Ref mirror of `points` so `commitCurrent` can read the latest geometry WITHOUT
  // doing side effects inside a setState updater (which runs during render).
  const pointsRef = useRef<Point2D[]>(points);
  pointsRef.current = points;

  // Accumulating local annotation layer (in-memory only — NEVER Firestore).
  const { measurements, clearToken, commit } = useLocalMeasurements(scopeKey ?? null);

  const effectiveBounds: SceneBounds | null =
    sceneBounds ?? (rasterSize ? rectBoundsToScene(rasterSize.width, rasterSize.height) : null);

  // Unit resolution: a calibrated scale (raster background OR CalibrateScaleDialog) always
  // wins. With none (`unitsPerMeter=null`), DXF falls back to cm→m; raster stays in native px.
  const effectiveUnitsPerMeter: number | null =
    unitsPerMeter ?? (sceneBounds ? DXF_ASSUMED_UNITS_PER_METER : null);

  // Commit the in-progress measurement to the accumulating layer, then reset it.
  // Reads via `pointsRef` and performs `commit` + `setPoints` as SEPARATE
  // statements — never a side effect inside a setState updater (that runs during
  // render → "setState while rendering another component"). Safe to call from
  // effects + event handlers only.
  const commitCurrent = useCallback(() => {
    if (!mode) return;
    const pts = dedupeConsecutivePoints(pointsRef.current);
    if (pts.length < minPointsForMode(mode)) return;
    const { value, unit } = computeMeasurement(pts, mode, effectiveUnitsPerMeter, t);
    commit({ points: pts, mode, value, unit });
    setPoints([]);
  }, [mode, effectiveUnitsPerMeter, t, commit]);

  // Reset accumulated in-progress points whenever the active mode toggles.
  useEffect(() => {
    setPoints([]);
    setCursor(null);
  }, [mode]);

  // «Clear all» wipes the layer AND the in-progress geometry.
  useEffect(() => {
    setPoints([]);
    setCursor(null);
  }, [clearToken]);

  // Fixed-arity modes auto-commit as soon as they are complete: DISTANCE at 2
  // clicks (AutoCAD DIST — each pair is its own measurement), ANGLE at 3. AREA
  // is variable-length → finished explicitly with Enter / double-click.
  useEffect(() => {
    if (mode === 'distance' && points.length === 2) commitCurrent();
    else if (mode === 'angle' && points.length === 3) commitCurrent();
  }, [mode, points.length, commitCurrent]);

  // ESC cancels the in-progress measurement; Enter finishes an area polygon.
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPoints([]);
      } else if (e.key === 'Enter' && mode === 'area') {
        commitCurrent();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, commitCurrent]);

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

  // Render committed layer + in-progress measurement + rubber band to cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // NOTE: do NOT bail on `points.length === 0` — committed measurements + the snap
    // indicator must still draw while hovering to pick the FIRST point.
    if (!mode || !effectiveBounds) return;

    const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);

    // Accumulated (committed) measurements — the local annotation layer.
    for (const m of measurements) {
      drawCommittedMeasurement(ctx, m, effectiveBounds, fit, effectiveUnitsPerMeter, t);
    }

    // In-progress measurement geometry (only once at least one point exists).
    if (points.length >= 2) {
      if (mode === 'angle') {
        if (points.length >= 3) {
          const { value } = computeMeasurement(points, mode, effectiveUnitsPerMeter, t);
          drawAngleMeasurement(ctx, points, effectiveBounds, fit, value);
        } else {
          drawConfirmedAngleRay(ctx, points, effectiveBounds, fit);
        }
      } else {
        const { value, unit } = computeMeasurement(points, mode, effectiveUnitsPerMeter, t);
        drawMeasurement(
          ctx,
          { points, mode, value, unit },
          effectiveBounds,
          fit,
          { stroke: STROKE_COLOR, lineWidth: STROKE_WIDTH },
        );
        if (mode === 'distance') {
          drawSegmentLabels(ctx, points, effectiveBounds, fit, effectiveUnitsPerMeter, t);
        }
      }
    } else if (points.length === 1) {
      // Single confirmed point — drawMeasurement skips it; render marker manually.
      const s = worldToScreen(points[0].x, points[0].y, effectiveBounds, fit);
      ctx.fillStyle = STROKE_COLOR;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cursor) {
      if (points.length > 0) {
        drawRubberBand(ctx, points, cursor.pos, mode, effectiveBounds, fit, effectiveUnitsPerMeter, t);
      }
      if (cursor.snapped) drawSnapIndicator(ctx, cursor.pos, effectiveBounds, fit, cursor.snapType);
    }

    // AREA close affordance: ring on the first vertex once the polygon is valid
    // (≥3 pts); fills when the cursor is within closing distance.
    if (mode === 'area' && points.length >= 3) {
      const active = !!cursor
        && screenDistance(points[0], cursor.pos, effectiveBounds, fit) <= CLOSE_POLYGON_TOLERANCE_PX;
      drawAreaCloseHandle(ctx, points[0], effectiveBounds, fit, active);
    }
  }, [points, cursor, mode, measurements, effectiveBounds, effectiveUnitsPerMeter, zoom, panOffset, t]);

  // SSoT for pointer→world resolution (+ snap + fit). Shared by click + move
  // handlers (N.18 — one place computes the rect/fit/world/snap chain).
  const resolvePointer = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { world: Point2D; snap: MeasureSnapPoint | null; fit: FitTransform } | null => {
      if (!effectiveBounds) return null;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const fit = computeFitTransform(canvas.width, canvas.height, effectiveBounds, zoom, panOffset);
      const world = screenToWorld(sx, sy, effectiveBounds, fit);
      return { world, snap: findSnapPointRef.current?.(world, fit.scale) ?? null, fit };
    },
    [effectiveBounds, zoom, panOffset],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mode) return;
      const r = resolvePointer(e);
      if (!r || !effectiveBounds) return;
      const prev = pointsRef.current;
      // AREA: clicking the first vertex (with ≥3 points) closes + commits the polygon.
      if (
        mode === 'area' &&
        prev.length >= 3 &&
        screenDistance(prev[0], r.world, effectiveBounds, r.fit) <= CLOSE_POLYGON_TOLERANCE_PX
      ) {
        commitCurrent();
        return;
      }
      setPoints((p) => appendPoint(p, r.snap?.point ?? r.world, mode));
    },
    [mode, resolvePointer, effectiveBounds, commitCurrent],
  );

  // Double-click closes an area polygon (distance auto-commits at 2 pts, angle at 3).
  const handleDoubleClick = useCallback(() => {
    if (mode === 'area') commitCurrent();
  }, [mode, commitCurrent]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mode) return;
      const r = resolvePointer(e);
      if (!r) return;
      setCursor({ pos: r.snap?.point ?? r.world, snapped: !!r.snap, snapType: r.snap?.type });
    },
    [mode, resolvePointer],
  );

  const handleMouseLeave = useCallback(() => setCursor(null), []);

  if (!mode) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('absolute inset-0 cursor-crosshair', className)}
      aria-label={t('floorplan.measure.toolbar')}
    />
  );
}

export default MeasureToolOverlay;
