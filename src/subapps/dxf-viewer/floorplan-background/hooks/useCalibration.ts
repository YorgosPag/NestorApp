'use client';

import { useMemo } from 'react';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import type { CalibrationData, CalibrationUnit, BackgroundTransform } from '../providers/types';
import type { Point2D } from '../providers/types';

// ── Unit conversion ───────────────────────────────────────────────────────────

const UNIT_TO_MM: Record<CalibrationUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  ft: 304.8,
  in: 25.4,
};

// ── Return type ───────────────────────────────────────────────────────────────

export interface UseCalibrationResult {
  isActive: boolean;
  hasPointA: boolean;
  hasPointB: boolean;
  /** Euclidean canvas-pixel distance between A and B (0 if incomplete). */
  pixelDist: number;
  startCalibration: () => void;
  cancelCalibration: () => void;
  /**
   * Computes new scale (and optional rotation) from the two picked canvas points.
   * Assumes 1 DXF world unit = 1 mm (construction-DXF convention).
   * Phase 7 will parameterise this from the DXF file's INSUNITS header.
   */
  applyCalibration: (
    realDist: number,
    unit: CalibrationUnit,
    deriveRotation: boolean,
    currentTransform: BackgroundTransform,
  ) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCalibration(floorId: string): UseCalibrationResult {
  const session = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const isActive = session?.floorId === floorId && floorId !== '';
  const pointA = isActive ? (session?.pointA ?? null) : null;
  const pointB = isActive ? (session?.pointB ?? null) : null;
  const worldToCanvasScale = isActive ? (session?.worldToCanvasScale ?? 1) : 1;

  const pixelDist = useMemo(() => {
    if (!pointA || !pointB) return 0;
    return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
  }, [pointA, pointB]);

  const startCalibration = () =>
    useFloorplanBackgroundStore.getState().startCalibration(floorId);

  const cancelCalibration = () =>
    useFloorplanBackgroundStore.getState().cancelCalibration();

  const applyCalibration = (
    realDist: number,
    unit: CalibrationUnit,
    deriveRotation: boolean,
    currentTransform: BackgroundTransform,
  ) => {
    if (!pointA || !pointB || pixelDist < 1) return;
    const partial = _computeTransformPartial(
      pointA, pointB, realDist, unit, deriveRotation, worldToCanvasScale, currentTransform,
    );
    const calibrationData = _buildCalibrationData(pointA, pointB, realDist, unit, deriveRotation);
    useFloorplanBackgroundStore.getState().applyCalibration(floorId, partial, calibrationData);
  };

  return { isActive, hasPointA: pointA !== null, hasPointB: pointB !== null, pixelDist, startCalibration, cancelCalibration, applyCalibration };
}

// ── Private math helpers ──────────────────────────────────────────────────────

function _computeTransformPartial(
  a: Point2D,
  b: Point2D,
  realDist: number,
  unit: CalibrationUnit,
  deriveRotation: boolean,
  worldToCanvasScale: number,
  current: BackgroundTransform,
): Partial<BackgroundTransform> {
  const dCanvas = Math.hypot(b.x - a.x, b.y - a.y);
  const dWorld = dCanvas / worldToCanvasScale;
  const realDistMm = realDist * UNIT_TO_MM[unit];
  const scaleFactor = realDistMm / dWorld;
  const partial: Partial<BackgroundTransform> = {
    scaleX: current.scaleX * scaleFactor,
    scaleY: current.scaleY * scaleFactor,
  };
  if (deriveRotation) {
    // canvas Y-down: positive angle = clockwise. Subtract to make segment horizontal.
    const angleDeg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    partial.rotation = ((current.rotation - angleDeg) % 360 + 360) % 360;
  }
  return partial;
}

function _buildCalibrationData(
  a: Point2D,
  b: Point2D,
  realDist: number,
  unit: CalibrationUnit,
  deriveRotation: boolean,
): CalibrationData {
  return {
    method: 'two-point',
    pointA: a,
    pointB: b,
    realDistance: realDist,
    unit,
    rotationDerived: deriveRotation,
    calibratedAt: Date.now(),
    calibratedBy: '', // Phase 7: populate from auth context
  };
}
