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
// Display-unit SSoT for the tooltip distance (mm → cm/m/… + locale + unit label).
import { formatSnapTrackingLabel } from '../../rendering/entities/shared/distance-label-utils';

export interface PolarTrackingConfig {
  incrementAngle: number;
  additionalAngles: readonly number[];
  angleTolerance: number;
  /**
   * ADR-508 (2026-06-21) — relative-polar base angle (degrees, world). The
   * snap targets become `baseAngle + k·increment` (and `baseAngle + additional`)
   * instead of the absolute `k·increment`. Default `0` = world-frame polar
   * (backward-compatible: identical to the pre-baseAngle behaviour).
   *
   * Used by the wall tool's 2nd click to snap relative to the face of the
   * existing member the start anchored to (Revit "angle relative to face"):
   * `baseAngle` = perpendicular-to-face direction ⇒ `0°` relative = perpendicular
   * (the flush case), `±90°` = parallel to the face.
   */
  baseAngle?: number;
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

  // ADR-508 — relative-polar: snap in the frame rotated by `baseAngle`, then add
  // it back. `baseAngle = 0` ⇒ `relAngle === rawAngle` ⇒ world behaviour intact.
  const baseAngle = config.baseAngle ?? 0;
  const relAngle = AngleUtils.normalizeAngle(rawAngle - baseAngle);

  let snappedRel: number | null = null;

  // 1. Increment snap: 0°, increment°, 2×increment°, … up to 360° (relative).
  if (config.incrementAngle > 0) {
    snappedRel = AngleUtils.snapAngleToStep(
      relAngle,
      config.incrementAngle,
      config.angleTolerance,
    );
  }

  // 2. Additional specific angles — relative to `baseAngle` too (checked if increment didn't match).
  if (snappedRel === null && config.additionalAngles.length > 0) {
    let minDiff = config.angleTolerance;
    for (const candidate of config.additionalAngles) {
      const normalized = AngleUtils.normalizeAngle(candidate);
      const diff = Math.min(
        Math.abs(relAngle - normalized),
        360 - Math.abs(relAngle - normalized),
      );
      if (diff < minDiff) {
        minDiff = diff;
        snappedRel = normalized;
      }
    }
  }

  if (snappedRel === null) {
    return { point, isSnapped: false, snappedAngle: null, distance };
  }

  // Back to world frame for the projection + the (absolute) tooltip angle.
  const snappedAngle = AngleUtils.normalizeAngle(snappedRel + baseAngle);

  // Project point onto the snapped angle at same distance
  const rad = degToRad(snappedAngle);
  const snappedPoint: Point2D = {
    x: ref.x + distance * Math.cos(rad),
    y: ref.y + distance * Math.sin(rad),
  };

  return { point: snappedPoint, isSnapped: true, snappedAngle, distance };
}

/**
 * Format polar tooltip label: "45.0° / 1,25 m" — the snapped angle + the slide
 * distance in the LIVE display unit (mm → cm/m/… + locale separator + unit label,
 * via the display-measurement SSoT). `distanceMm` is the canonical-millimetre slide
 * length; the CALLER converts world → mm (÷ sceneUnitsScale) so this stays pure.
 *
 * (2026-07-04 — completes the deferred "Phase 2" unit conversion: the label used to
 * emit raw world units, e.g. "180.0° / 4448.7" instead of "180.0° / 444,87 cm".)
 */
export function formatPolarLabel(snappedAngle: number, distanceMm: number): string {
  return formatSnapTrackingLabel(snappedAngle, distanceMm, 1);
}

/**
 * ADR-508 — display angle (0–90°) for the wall relative-polar-to-face tooltip.
 *
 * The snap uses `perpBaseAngle` = the **perpendicular-to-face** world direction as
 * its base. The user, however, thinks in "angle relative to the face surface"
 * (Revit «angle relative to face»): perpendicular ⇒ **90°**, parallel ⇒ **0°**.
 * So we report the acute angle between the drawn direction and the FACE — NOT the
 * absolute world heading (which is what made the tooltip read e.g. "41.9°" while
 * the wall was visibly perpendicular). Returns a value in `[0, 90]`.
 */
export function faceRelativeDisplayAngle(absAngleDeg: number, perpBaseAngle: number): number {
  const relToPerp = AngleUtils.normalizeAngle(absAngleDeg - perpBaseAngle); // [0,360) off perpendicular
  const to180 = relToPerp > 180 ? 360 - relToPerp : relToPerp;             // [0,180]
  const acuteToPerp = to180 > 90 ? 180 - to180 : to180;                    // [0,90] off perpendicular
  return 90 - acuteToPerp;                                                  // [0,90] off the face surface
}
