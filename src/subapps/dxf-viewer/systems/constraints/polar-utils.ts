/**
 * POLAR TRACKING UTILITIES — ADR-357 Phase 1
 *
 * Pure functions for AutoCAD-style polar angle snapping.
 * Pipeline: rawPoint → applyPolar(point, ref, config) → snappedPoint
 *
 * Logic: Increment-multiples ∪ Additional angles — closest within tolerance wins.
 */

import type { Point2D } from '../../rendering/types/Types';
import { AngleUtils, DistanceUtils } from './constraints-geometry';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

export interface PolarTrackingConfig {
  incrementAngle: number;
  additionalAngles: number[];
  angleTolerance: number;
}

export interface PolarSnapResult {
  point: Point2D;
  isSnapped: boolean;
  snappedAngle: number | null;
  distance: number;
}

const MIN_DISTANCE = 0.001;

/**
 * Apply polar tracking constraint — pure function.
 *
 * Snaps `point` to the nearest polar angle from `ref` when within tolerance.
 * Ortho and Polar are mutually exclusive: caller decides which to apply.
 */
export function applyPolar(
  point: Point2D,
  ref: Point2D,
  config: PolarTrackingConfig,
): PolarSnapResult {
  const dx = point.x - ref.x;
  const dy = point.y - ref.y;
  const distance = DistanceUtils.distance(ref, point);

  if (distance < MIN_DISTANCE) {
    return { point, isSnapped: false, snappedAngle: null, distance: 0 };
  }

  // Angle from ref → point in world space (Y-up, 0°=East, 90°=North)
  const rawAngle = AngleUtils.normalizeAngle(
    AngleUtils.radiansToDegrees(Math.atan2(dy, dx)),
  );

  let snappedAngle: number | null = null;

  // 1. Increment snap: 0°, increment°, 2×increment°, … up to 360°
  if (config.incrementAngle > 0) {
    snappedAngle = AngleUtils.snapAngleToStep(
      rawAngle,
      config.incrementAngle,
      config.angleTolerance,
    );
  }

  // 2. Additional specific angles (checked if increment didn't match)
  if (snappedAngle === null && config.additionalAngles.length > 0) {
    let minDiff = config.angleTolerance;
    for (const candidate of config.additionalAngles) {
      const normalized = AngleUtils.normalizeAngle(candidate);
      const diff = Math.min(
        Math.abs(rawAngle - normalized),
        360 - Math.abs(rawAngle - normalized),
      );
      if (diff < minDiff) {
        minDiff = diff;
        snappedAngle = normalized;
      }
    }
  }

  if (snappedAngle === null) {
    return { point, isSnapped: false, snappedAngle: null, distance };
  }

  // Project point onto the snapped angle at same distance
  const rad = degToRad(snappedAngle);
  const snappedPoint: Point2D = {
    x: ref.x + distance * Math.cos(rad),
    y: ref.y + distance * Math.sin(rad),
  };

  return { point: snappedPoint, isSnapped: true, snappedAngle, distance };
}

/**
 * Format polar tooltip label: "45.0° / 125.3"
 * Distance in raw world units (mm). Display unit conversion in Phase 2.
 */
export function formatPolarLabel(snappedAngle: number, distance: number): string {
  return `${snappedAngle.toFixed(1)}° / ${distance.toFixed(1)}`;
}
