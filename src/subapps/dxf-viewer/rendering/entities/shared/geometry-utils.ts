/**
 * UNIFIED GEOMETRY UTILITIES
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινές γεωμετρικές λειτουργίες για όλους τους renderers
 * Συνδυάζει όλα τα geometry utilities σε ένα αρχείο
 */

import type { Point2D, BoundingBox } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-070: Centralized Vector Magnitude
// 🏢 ADR-072: Centralized Dot Product
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateDistance, vectorMagnitude, dotProduct, calculateMidpoint } from './geometry-rendering-utils';

// Re-export calculateMidpoint for convenience (canonical source: geometry-rendering-utils.ts)
export { calculateMidpoint };

// ===== DISTANCE CALCULATIONS =====

// Διαγράφηκε το διπλότυπο pointDistance - χρησιμοποιείστε calculateDistance από geometry-rendering-utils

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
    clampedProjection = Math.max(0, Math.min(length, projection));
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

  const dotProduct = vectorToPoint.x * dx + vectorToPoint.y * dy;
  return dotProduct / lengthSquared;
}

// ===== BISECTOR ANGLE =====
// 🏢 ADR-073: Centralized Midpoint/Bisector Calculations (2026-01-31)

/**
 * Calculate the bisector angle between two angles
 * ✅ CENTRALIZED: Single source of truth για angle bisector
 *
 * Used for: angle measurement labels, polyline corner arcs, preview arc text
 *
 * @param angle1 - First angle in radians
 * @param angle2 - Second angle in radians
 * @returns The bisector angle (average of the two angles)
 *
 * @example
 * const bisector = bisectorAngle(angle1, angle2);
 * const labelX = vertex.x + Math.cos(bisector) * distance;
 */
export function bisectorAngle(angle1: number, angle2: number): number {
  return (angle1 + angle2) / 2;
}

// ===== ANGLE CALCULATIONS =====

/**
 * Calculate angle between two vectors from a common point
 */
export function angleBetweenPoints(vertex: Point2D, point1: Point2D, point2: Point2D): number {
  const v1 = { x: point1.x - vertex.x, y: point1.y - vertex.y };
  const v2 = { x: point2.x - vertex.x, y: point2.y - vertex.y };

  // 🏢 ADR-072: Use centralized dot product
  const dot = dotProduct(v1, v2);
  // 🏢 ADR-070: Use centralized vector magnitude
  const mag1 = vectorMagnitude(v1);
  const mag2 = vectorMagnitude(v2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));

  return Math.acos(clampedCos);
}

/**
 * Calculate angle from horizontal (0 to 2π)
 */
export function angleFromHorizontal(start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
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

// ===== CIRCLE GEOMETRY =====

/**
 * Calculate center and radius of circle from 3 points
 */
export function circleFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D): { center: Point2D; radius: number } | null {
  const ax = p1.x; const ay = p1.y;
  const bx = p2.x; const by = p2.y;
  const cx = p3.x; const cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  if (Math.abs(d) < 1e-10) {
    return null; // Points are collinear
  }

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  const radius = calculateDistance(center, p1);

  return { center, radius };
}

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
  const startAngleRad = Math.atan2(start.y - center.y, start.x - center.x);
  const midAngleRad = Math.atan2(mid.y - center.y, mid.x - center.x);
  const endAngleRad = Math.atan2(end.y - center.y, end.x - center.x);

  // 🏢 ENTERPRISE: Determine arc direction using angular sweep
  // In Canvas 2D, anticlockwise=false draws CLOCKWISE from startAngle to endAngle
  // We need to check if going clockwise from start includes mid before reaching end

  // Helper: Calculate clockwise angular distance from angle 'from' to angle 'to'
  const clockwiseDistance = (from: number, to: number): number => {
    let diff = to - from;
    // Normalize to [0, 2π) for clockwise distance
    while (diff < 0) diff += 2 * Math.PI;
    while (diff >= 2 * Math.PI) diff -= 2 * Math.PI;
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
  const startAngleRad = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngleRad = Math.atan2(end.y - center.y, end.x - center.x);

  // 🏢 ENTERPRISE: Calculate angular direction (AutoCAD pattern)
  // Determine if user moved counterclockwise or clockwise from start to end
  let angleDiff = endAngleRad - startAngleRad;
  // Normalize to (-π, π] to find the "short" direction
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;

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
  if (sweepAngle < 0) sweepAngle += 2 * Math.PI;
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

// ===== POLYLINE GEOMETRY =====

/**
 * Calculate total length of a polyline (sum of segment distances)
 * ✅ CENTRALIZED (2026-01-26): Single source of truth για polyline length calculation
 * Used by: measurement tools, drawing info, entity properties
 *
 * @param points - Array of polyline vertices
 * @param isClosed - Whether to include closing segment (last point to first)
 * @returns Total length in linear units
 */
export function calculatePolylineLength(points: Point2D[], isClosed = false): number {
  if (points.length < 2) return 0;

  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    totalLength += calculateDistance(points[i - 1], points[i]);
  }

  // Add closing segment if closed
  if (isClosed && points.length > 2) {
    totalLength += calculateDistance(points[points.length - 1], points[0]);
  }

  return totalLength;
}

/**
 * Calculate perimeter of a polygon (always closed)
 * ✅ CENTRALIZED (2026-01-26): Convenience function for polygon perimeter
 *
 * @param points - Array of polygon vertices
 * @returns Perimeter length in linear units
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  return calculatePolylineLength(points, true);
}

/**
 * Calculate polygon area using Shoelace formula (Gauss's area formula)
 * ✅ CENTRALIZED (2026-01-26): Single source of truth για area calculation
 * Used by: measurement tools, overlay properties, selection info
 *
 * @param points - Array of polygon vertices (closed or open - will auto-close)
 * @returns Area in square units (always positive)
 *
 * Algorithm: Shoelace formula - sum of (x[i] * y[i+1] - x[i+1] * y[i]) / 2
 * Reference: https://en.wikipedia.org/wiki/Shoelace_formula
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate centroid (center of mass) of a polygon
 * ✅ CENTRALIZED (2026-01-26): Single source of truth για centroid calculation
 * Used by: measurement labels, entity positioning, selection indicators
 *
 * @param points - Array of polygon vertices
 * @returns Centroid point
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  const area = calculatePolygonArea(points);
  if (area === 0) {
    // Degenerate polygon - return average of points
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }

  const factor = 1 / (6 * area);
  return {
    x: cx * factor,
    y: cy * factor
  };
}

/**
 * Simplify polyline using Ramer-Douglas-Peucker algorithm
 */
export function simplifyPolyline(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points;

  const simplifyRecursive = (pts: Point2D[], first: number, last: number, tolerance: number): Point2D[] => {
    if (last - first <= 1) return [pts[first], pts[last]];

    let maxDistance = 0;
    let maxIndex = first;

    for (let i = first + 1; i < last; i++) {
      const distance = pointToLineDistance(pts[i], pts[first], pts[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const left = simplifyRecursive(pts, first, maxIndex, tolerance);
      const right = simplifyRecursive(pts, maxIndex, last, tolerance);
      return [...left.slice(0, -1), ...right];
    } else {
      return [pts[first], pts[last]];
    }
  };

  return simplifyRecursive(points, 0, points.length - 1, tolerance);
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

// ===== ANGLE CONVERSION CONSTANTS & FUNCTIONS =====
// 🏢 ADR-067: Centralized Radians/Degrees Conversion (2026-01-31)

/**
 * Conversion constant: degrees to radians
 * Usage: angleRadians = angleDegrees * DEGREES_TO_RADIANS
 */
export const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Conversion constant: radians to degrees
 * Usage: angleDegrees = angleRadians * RADIANS_TO_DEGREES
 */
export const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Convert degrees to radians
 * 🏢 ADR-067: Canonical source for deg→rad conversion
 */
export function degToRad(degrees: number): number {
  return degrees * DEGREES_TO_RADIANS;
}

/**
 * Convert radians to degrees
 * 🏢 ADR-067: Canonical source for rad→deg conversion
 */
export function radToDeg(radians: number): number {
  return radians * RADIANS_TO_DEGREES;
}

// ===== ANGLE NORMALIZATION =====
// 🏢 ADR-068: Centralized Angle Normalization (2026-01-31)

/** Two PI constant for angle calculations */
const TAU = 2 * Math.PI;

/**
 * Normalize angle in RADIANS to [0, 2π) range
 * Handles any input value (including multiple wraps and extreme values)
 *
 * @param radians - Angle in radians (any value)
 * @returns Normalized angle in [0, 2π) range
 *
 * @example
 * normalizeAngleRad(-Math.PI / 2)  // → 3π/2 (≈4.712)
 * normalizeAngleRad(3 * Math.PI)   // → π (≈3.142)
 * normalizeAngleRad(0)             // → 0
 */
export function normalizeAngleRad(radians: number): number {
  let normalized = radians % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized;
}

/**
 * Normalize angle in DEGREES to [0, 360) range
 * Handles any input value (including multiple wraps and extreme values)
 *
 * @param degrees - Angle in degrees (any value)
 * @returns Normalized angle in [0, 360) range
 *
 * @example
 * normalizeAngleDeg(-90)   // → 270
 * normalizeAngleDeg(450)   // → 90
 * normalizeAngleDeg(360)   // → 0
 */
export function normalizeAngleDeg(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}