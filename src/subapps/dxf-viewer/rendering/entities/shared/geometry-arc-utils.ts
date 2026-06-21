/**
 * GEOMETRY ARC UTILITIES
 * ADR-065: Extracted from geometry-utils.ts — Arc construction and measurement
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
import { calculateDistance, calculateAngle } from './geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../primitives/canvasPaths';
// 🏢 ADR-065: Extracted circle construction
import { circleFrom3Points } from './geometry-circle-utils';
// 🏢 ADR-065: Extracted angle utilities
import { radToDeg, normalizeAngleDiff, normalizeAngleRad } from './geometry-angle-utils';

// ===== ARC GEOMETRY =====

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from 3 points - ADR-059
 * Uses circumcircle calculation + angle determination
 *
 * The arc will pass through all 3 points: start → mid → end
 *
 * @param start - Start point of the arc
 * @param mid - Point on the arc (between start and end)
 * @param end - End point of the arc
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFrom3Points(
  start: Point2D,
  mid: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } | null {
  // Use circumcircle calculation
  const circle = circleFrom3Points(start, mid, end);
  if (!circle) return null;

  const { center, radius } = circle;

  // Calculate angles for all 3 points (in radians)
  // 🏢 ADR-065: Use centralized calculateAngle
  const startAngleRad = calculateAngle(center, start);
  const midAngleRad = calculateAngle(center, mid);
  const endAngleRad = calculateAngle(center, end);

  // 🏢 ENTERPRISE: Determine arc direction using angular sweep
  // In Canvas 2D, anticlockwise=false draws CLOCKWISE from startAngle to endAngle
  // We need to check if going clockwise from start includes mid before reaching end

  // Helper: Calculate clockwise angular distance from angle 'from' to angle 'to'
  const clockwiseDistance = (from: number, to: number): number => {
    let diff = to - from;
    // Normalize to [0, 2π) for clockwise distance
    while (diff < 0) diff += TAU;
    while (diff >= TAU) diff -= TAU;
    return diff;
  };

  // Distance from start to mid going clockwise
  const startToMidCW = clockwiseDistance(startAngleRad, midAngleRad);
  // Distance from start to end going clockwise
  const startToEndCW = clockwiseDistance(startAngleRad, endAngleRad);

  // If startToMidCW < startToEndCW, then mid is on the CLOCKWISE arc from start to end
  // This means we should use anticlockwise=false (draw clockwise)
  const isMidOnCWArc = startToMidCW < startToEndCW;

  // Convert to degrees
  const startAngleDeg = radToDeg(startAngleRad);
  const endAngleDeg = radToDeg(endAngleRad);

  return {
    center,
    radius,
    startAngle: startAngleDeg,
    endAngle: endAngleDeg,
    // counterclockwise=false means draw clockwise; true means draw counterclockwise
    counterclockwise: !isMidOnCWArc
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from center, start, end points - ADR-059
 *
 * The arc direction (clockwise/counterclockwise) is determined by the
 * angular direction from start to end - AutoCAD pattern!
 * This allows the user to control the arc side by moving the mouse
 * clockwise or counterclockwise around the center.
 *
 * @param center - Center point of the arc
 * @param start - Start point on the arc circumference
 * @param end - End point (or cursor position) - direction determines arc side
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFromCenterStartEnd(
  center: Point2D,
  start: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } {
  const radius = calculateDistance(center, start);

  // Calculate angles
  // 🏢 ADR-065: Use centralized calculateAngle
  const startAngleRad = calculateAngle(center, start);
  const endAngleRad = calculateAngle(center, end);

  // 🏢 ENTERPRISE: Calculate angular direction (AutoCAD pattern)
  // Determine if user moved counterclockwise or clockwise from start to end
  // 🏢 ADR-134: Use centralized angle difference normalization
  const angleDiff = normalizeAngleDiff(endAngleRad - startAngleRad);

  // If angleDiff > 0, user moved counterclockwise (CCW) → draw CCW arc
  // If angleDiff < 0, user moved clockwise (CW) → draw CW arc
  const counterclockwise = angleDiff > 0;

  return {
    center,
    radius,
    startAngle: radToDeg(startAngleRad),
    endAngle: radToDeg(endAngleRad),
    counterclockwise
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate arc from start, center, end points - ADR-059
 * Same as centerStartEnd but with different input order
 *
 * @param start - Start point on the arc circumference
 * @param center - Center point of the arc
 * @param end - End point on the arc circumference
 * @returns Arc definition with center, radius, angles in DEGREES, and counterclockwise flag
 */
export function arcFromStartCenterEnd(
  start: Point2D,
  center: Point2D,
  end: Point2D
): { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } {
  return arcFromCenterStartEnd(center, start, end);
}

/**
 * Calculate arc length
 */
export function calculateArcLength(radius: number, startAngle: number, endAngle: number): number {
  let sweepAngle = endAngle - startAngle;
  if (sweepAngle < 0) sweepAngle += TAU;
  return radius * sweepAngle;
}

/**
 * Check if angle is between start and end angles (handling wrap-around)
 */
export function isAngleBetween(angle: number, startAngle: number, endAngle: number): boolean {
  // 🏢 ADR-068: Use centralized angle normalization
  const testAngle = normalizeAngleRad(angle);
  const start = normalizeAngleRad(startAngle);
  const end = normalizeAngleRad(endAngle);

  if (start <= end) {
    return testAngle >= start && testAngle <= end;
  } else {
    return testAngle >= start || testAngle <= end;
  }
}
