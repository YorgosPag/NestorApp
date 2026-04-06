/**
 * UNIFIED GEOMETRY UTILITIES
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινές γεωμετρικές λειτουργίες για όλους τους renderers
 * ADR-065: Split into focused modules — this file keeps core utilities + re-exports all
 */

import type { Point2D, BoundingBox } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
// 🏢 ADR-073: Centralized Midpoint Calculation
// 🏢 ADR-090: Centralized Point Vector Operations
// 🏢 ADR-164: Added getPerpendicularUnitVector for line direction normalization
import { calculateDistance, calculateMidpoint, getUnitVector, getPerpendicularUnitVector } from './geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant (TAU)
import { TAU } from '../../primitives/canvasPaths';
// 🏢 ADR-079: Centralized Geometric Precision Constants & Utility Functions
import { GEOMETRY_PRECISION } from '../../../config/tolerance-config';

// ===== RE-EXPORTS FROM SPLIT MODULES (ADR-065) =====
// Zero consumer impact — all names remain accessible from this file

export * from './geometry-angle-utils';
export * from './geometry-circle-utils';
export * from './geometry-arc-utils';
export * from './geometry-polyline-utils';

// Re-export calculateMidpoint for convenience (canonical source: geometry-rendering-utils.ts)
export { calculateMidpoint };
// Re-export TAU for convenience (canonical source: canvasPaths.ts)
export { TAU };

// ===== DISTANCE CALCULATIONS =====

/**
 * Calculate distance from a point to a line segment
 * Used in hit testing across multiple renderers
 */
export function pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const nearestPoint = getNearestPointOnLine(point, lineStart, lineEnd, true);
  // 🏢 ADR-065: Use centralized distance calculation
  return calculateDistance(point, nearestPoint);
}

/**
 * Calculate distance from point to circle
 */
export function pointToCircleDistance(point: Point2D, center: Point2D, radius: number): number {
  const centerDistance = calculateDistance(point, center);
  return Math.abs(centerDistance - radius);
}

// ===== NEAREST POINT CALCULATIONS =====

/**
 * Get nearest point on a line segment
 */
export function getNearestPointOnLine(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
  clampToSegment: boolean = true
): Point2D {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  // 🏢 ADR-065: Use centralized distance calculation
  const length = calculateDistance(lineStart, lineEnd);

  if (length === 0) {
    return { ...lineStart };
  }

  const normalizedDx = dx / length;
  const normalizedDy = dy / length;

  const vectorToPoint = {
    x: point.x - lineStart.x,
    y: point.y - lineStart.y
  };

  const projection = vectorToPoint.x * normalizedDx + vectorToPoint.y * normalizedDy;

  let clampedProjection = projection;
  if (clampToSegment) {
    clampedProjection = clamp(projection, 0, length);
  }

  return {
    x: lineStart.x + clampedProjection * normalizedDx,
    y: lineStart.y + clampedProjection * normalizedDy
  };
}

/**
 * Get line parameter (t) for a point projection onto a line
 * Returns 0 for lineStart, 1 for lineEnd, <0 or >1 for extensions
 */
export function getLineParameter(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return 0; // Start and end are the same point
  }

  const vectorToPoint = {
    x: point.x - lineStart.x,
    y: point.y - lineStart.y
  };

  const dot = vectorToPoint.x * dx + vectorToPoint.y * dy;
  return dot / lengthSquared;
}

// ===== BOUNDING BOX CALCULATIONS =====

/**
 * Calculate bounding box for a set of points
 */
export function calculateBoundingBox(points: Point2D[]): BoundingBox | null {
  if (points.length === 0) return null;

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}

/**
 * Expand bounding box to include a point
 */
export function expandBoundingBox(bbox: BoundingBox, point: Point2D): BoundingBox {
  return {
    min: {
      x: Math.min(bbox.min.x, point.x),
      y: Math.min(bbox.min.y, point.y)
    },
    max: {
      x: Math.max(bbox.max.x, point.x),
      y: Math.max(bbox.max.y, point.y)
    }
  };
}

/**
 * Check if point is inside bounding box
 */
export function isPointInBoundingBox(point: Point2D, bbox: BoundingBox, tolerance: number = 0): boolean {
  return point.x >= bbox.min.x - tolerance &&
         point.x <= bbox.max.x + tolerance &&
         point.y >= bbox.min.y - tolerance &&
         point.y <= bbox.max.y + tolerance;
}

// ===== PERPENDICULAR & PARALLEL LINE CONSTRUCTION =====
// 🏢 ADR-060: Line Construction Tools (Perpendicular & Parallel) (2026-01-31)

/**
 * 🏢 ENTERPRISE (2026-01-31): Create a perpendicular line through a point - ADR-060
 *
 * Given a reference line and a through-point, creates a line perpendicular
 * to the reference that passes through (or near) the given point.
 *
 * @param refStart - Start point of reference line
 * @param refEnd - End point of reference line
 * @param throughPoint - Point that the perpendicular should pass through/near
 * @param length - Length of the resulting perpendicular line (default 100)
 * @returns Line definition with start and end points, or null if reference is degenerate
 */
export function createPerpendicularLine(
  refStart: Point2D,
  refEnd: Point2D,
  throughPoint: Point2D,
  length: number = 100
): { start: Point2D; end: Point2D } | null {
  // 🏢 ADR-164: Use centralized distance calculation
  const refLength = calculateDistance(refStart, refEnd);

  // 🏢 ADR-079: Use centralized tolerance
  if (refLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Reference line is degenerate (point)
  }

  // 🏢 ADR-065/ADR-164: Use centralized unit vector functions
  const refDir = getUnitVector(refStart, refEnd);
  const perpDir = getPerpendicularUnitVector(refStart, refEnd);

  // Project throughPoint onto reference line to find intersection
  const toPointX = throughPoint.x - refStart.x;
  const toPointY = throughPoint.y - refStart.y;
  const projLength = toPointX * refDir.x + toPointY * refDir.y;

  // Intersection point (foot of perpendicular)
  const footX = refStart.x + projLength * refDir.x;
  const footY = refStart.y + projLength * refDir.y;

  // Create perpendicular line centered at the foot
  const halfLength = length / 2;

  return {
    start: {
      x: footX - perpDir.x * halfLength,
      y: footY - perpDir.y * halfLength
    },
    end: {
      x: footX + perpDir.x * halfLength,
      y: footY + perpDir.y * halfLength
    }
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Create a parallel line at offset distance - ADR-060
 *
 * Given a reference line and an offset point, creates a line parallel
 * to the reference at the same distance as the offset point.
 *
 * The parallel line has the same length as the reference line.
 *
 * @param refStart - Start point of reference line
 * @param refEnd - End point of reference line
 * @param offsetPoint - Point indicating which side and how far the parallel should be
 * @returns Line definition with start and end points, or null if reference is degenerate
 */
export function createParallelLine(
  refStart: Point2D,
  refEnd: Point2D,
  offsetPoint: Point2D
): { start: Point2D; end: Point2D } | null {
  // 🏢 ADR-164: Use centralized distance calculation
  const refLength = calculateDistance(refStart, refEnd);

  // 🏢 ADR-079: Use centralized tolerance
  if (refLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Reference line is degenerate (point)
  }

  // 🏢 ADR-065/ADR-164: Use centralized unit vector functions
  const perpDir = getPerpendicularUnitVector(refStart, refEnd);

  // Calculate signed distance from offsetPoint to reference line
  // Using the perpendicular direction as normal
  const toPointX = offsetPoint.x - refStart.x;
  const toPointY = offsetPoint.y - refStart.y;
  const signedDistance = toPointX * perpDir.x + toPointY * perpDir.y;

  // Create parallel line by offsetting reference endpoints
  return {
    start: {
      x: refStart.x + perpDir.x * signedDistance,
      y: refStart.y + perpDir.y * signedDistance
    },
    end: {
      x: refEnd.x + perpDir.x * signedDistance,
      y: refEnd.y + perpDir.y * signedDistance
    }
  };
}

// ===== MATHEMATICAL UTILITIES =====

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two points
 */
export function lerpPoint(p1: Point2D, p2: Point2D, t: number): Point2D {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t)
  };
}

// ===== CLAMP UTILITIES =====
// 🏢 ADR-071: Centralized Clamp Functions (2026-01-31)

/**
 * 🏢 ENTERPRISE: Clamp value between min and max
 * Canonical source for value clamping across DXF Viewer
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value within [min, max]
 *
 * @example
 * clamp(150, 0, 100) // → 100
 * clamp(-5, 0, 100)  // → 0
 * clamp(50, 0, 100)  // → 50
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 🏢 ENTERPRISE: Clamp value to [0, 1] range
 * Convenience function for opacity, alpha, percentage values
 *
 * @param value - Value to clamp
 * @returns Clamped value within [0, 1]
 *
 * @example
 * clamp01(1.5)  // → 1
 * clamp01(-0.2) // → 0
 * clamp01(0.7)  // → 0.7
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 🏢 ENTERPRISE: Clamp value to [0, 255] range
 * Convenience function for RGB color components
 *
 * @param value - Value to clamp
 * @returns Clamped value within [0, 255]
 *
 * @example
 * clamp255(300) // → 255
 * clamp255(-10) // → 0
 * clamp255(128) // → 128
 */
export function clamp255(value: number): number {
  return Math.max(0, Math.min(255, value));
}
