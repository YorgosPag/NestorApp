/**
 * UNIFIED GEOMETRY UTILITIES
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινές γεωμετρικές λειτουργίες για όλους τους renderers
 * Συνδυάζει όλα τα geometry utilities σε ένα αρχείο
 */

import type { Point2D, BoundingBox } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
// 🏢 ADR-070: Centralized Vector Magnitude
// 🏢 ADR-072: Centralized Dot Product
// 🏢 ADR-073: Centralized Midpoint Calculation
// 🏢 ADR-090: Centralized Point Vector Operations
import { calculateDistance, calculateAngle, vectorMagnitude, dotProduct, calculateMidpoint, subtractPoints, getUnitVector } from './geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant (TAU)
import { TAU } from '../../primitives/canvasPaths';
// 🏢 ADR-079: Centralized Geometric Precision Constants
import { GEOMETRY_PRECISION } from '../../../config/tolerance-config';

// Re-export calculateMidpoint for convenience (canonical source: geometry-rendering-utils.ts)
export { calculateMidpoint };
// Re-export TAU for convenience (canonical source: canvasPaths.ts)
export { TAU };

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
  // 🏢 ADR-090: Use centralized point subtraction
  const v1 = subtractPoints(point1, vertex);
  const v2 = subtractPoints(point2, vertex);

  // 🏢 ADR-072: Use centralized dot product
  const dot = dotProduct(v1, v2);
  // 🏢 ADR-070: Use centralized vector magnitude
  const mag1 = vectorMagnitude(v1);
  const mag2 = vectorMagnitude(v2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  const clampedCos = clamp(cosAngle, -1, 1);

  return Math.acos(clampedCos);
}

/**
 * Calculate angle from horizontal (0 to 2π)
 */
export function angleFromHorizontal(start: Point2D, end: Point2D): number {
  // 🏢 ADR-065: Use centralized calculateAngle
  let angle = calculateAngle(start, end);
  if (angle < 0) angle += TAU;
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
 * 🏢 ENTERPRISE (2026-01-31): Best-fit circle using Least Squares Circular Regression - ADR-083
 *
 * Calculates the circle that best fits a set of points using the algebraic circle fit (Kasa method).
 * This method minimizes the sum of squared algebraic distances.
 *
 * Algorithm: Kasa circle fit (linearized least squares)
 * For points (x_i, y_i), we fit the equation: x² + y² + Ax + By + C = 0
 * Then: center = (-A/2, -B/2), radius = sqrt(A²/4 + B²/4 - C)
 *
 * Reference: I. Kasa, "A circle fitting procedure and its error analysis", 1976
 *
 * @param points - Array of at least 3 points to fit
 * @returns Circle definition with center and radius, or null if fewer than 3 points
 *
 * @example
 * const result = circleBestFit([{x:0,y:0}, {x:10,y:0}, {x:5,y:5}, {x:3,y:4}]);
 * // Returns { center: {x: 5, y: 0}, radius: 5 } (approximately)
 */
export function circleBestFit(points: Point2D[]): { center: Point2D; radius: number } | null {
  // Need at least 3 points to define a circle
  if (points.length < 3) {
    return null;
  }

  const n = points.length;

  // 🏢 ENTERPRISE (2026-01-31): Hyper Circle Fit Algorithm
  // More numerically stable than basic Kasa method
  // Reference: "A Few Methods for Fitting Circles to Data" by Chernov & Lesort

  // Step 1: Calculate centroid (mean)
  let meanX = 0, meanY = 0;
  for (const p of points) {
    meanX += p.x;
    meanY += p.y;
  }
  meanX /= n;
  meanY /= n;

  // Step 2: Calculate centered coordinates and sums
  let Suu = 0, Suv = 0, Svv = 0;
  let Suuu = 0, Suvv = 0, Svvv = 0, Svuu = 0;

  for (const p of points) {
    const u = p.x - meanX;
    const v = p.y - meanY;

    Suu += u * u;
    Suv += u * v;
    Svv += v * v;
    Suuu += u * u * u;
    Suvv += u * v * v;
    Svvv += v * v * v;
    Svuu += v * u * u;
  }

  // Step 3: Solve the linear system for center offset (uc, vc)
  // | Suu  Suv | | uc |   | (Suuu + Suvv) / 2 |
  // | Suv  Svv | | vc | = | (Svvv + Svuu) / 2 |

  const det = Suu * Svv - Suv * Suv;

  // Check for degenerate case (collinear points)
  if (Math.abs(det) < 1e-10) {
    // Fallback: Use simple centroid method
    // Calculate center as centroid and radius as average distance
    let totalDist = 0;
    for (const p of points) {
      totalDist += Math.sqrt((p.x - meanX) ** 2 + (p.y - meanY) ** 2);
    }
    const avgRadius = totalDist / n;

    if (avgRadius < GEOMETRY_PRECISION.POINT_MATCH) {
      return null;
    }

    return {
      center: { x: meanX, y: meanY },
      radius: avgRadius
    };
  }

  // Solve for center offset
  const rhs1 = (Suuu + Suvv) / 2;
  const rhs2 = (Svvv + Svuu) / 2;

  const uc = (rhs1 * Svv - rhs2 * Suv) / det;
  const vc = (Suu * rhs2 - Suv * rhs1) / det;

  // Step 4: Calculate center in original coordinates
  const centerX = uc + meanX;
  const centerY = vc + meanY;

  // Step 5: Calculate radius as RMS distance from center
  let sumDistSq = 0;
  for (const p of points) {
    const dx = p.x - centerX;
    const dy = p.y - centerY;
    sumDistSq += dx * dx + dy * dy;
  }
  const radius = Math.sqrt(sumDistSq / n);

  // Validate radius
  if (radius < GEOMETRY_PRECISION.POINT_MATCH) {
    return null;
  }

  return {
    center: { x: centerX, y: centerY },
    radius
  };
}

/**
 * Calculate center and radius of circle from 3 points
 */
export function circleFrom3Points(p1: Point2D, p2: Point2D, p3: Point2D): { center: Point2D; radius: number } | null {
  const ax = p1.x; const ay = p1.y;
  const bx = p2.x; const by = p2.y;
  const cx = p3.x; const cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  // 🏢 ADR-079: Use centralized collinear tolerance
  if (Math.abs(d) < GEOMETRY_PRECISION.COLLINEAR_TOLERANCE) {
    return null; // Points are collinear
  }

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const center = { x: ux, y: uy };
  const radius = calculateDistance(center, p1);

  return { center, radius };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate circle from chord and sagitta - ADR-083
 *
 * Chord: Straight line connecting two points on the circle's circumference
 * Sagitta (Arrow): The perpendicular distance from the midpoint of the chord to the arc
 *
 * Mathematical formula:
 * Given chord length c and sagitta height h:
 * radius r = (c²/8h) + (h/2) = (c² + 4h²) / (8h)
 *
 * @param chordStart - Start point of the chord
 * @param chordEnd - End point of the chord
 * @param sagittaPoint - Point on the arc (defines the sagitta height)
 * @returns Circle definition with center and radius, or null if invalid
 */
export function circleFromChordAndSagitta(
  chordStart: Point2D,
  chordEnd: Point2D,
  sagittaPoint: Point2D
): { center: Point2D; radius: number } | null {
  // Calculate chord midpoint
  const midpoint = calculateMidpoint(chordStart, chordEnd);

  // Calculate chord length
  const chordLength = calculateDistance(chordStart, chordEnd);

  // 🏢 ADR-079: Use centralized tolerance for chord validation
  if (chordLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Chord too short
  }

  // Calculate sagitta height (perpendicular distance from midpoint to sagitta point)
  const sagittaHeight = calculateDistance(midpoint, sagittaPoint);

  // 🏢 ADR-079: Use centralized tolerance for sagitta validation
  if (sagittaHeight < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Sagitta too small (would result in infinite radius)
  }

  // Calculate radius using the chord-sagitta formula:
  // r = (c²/8h) + (h/2) = (c² + 4h²) / (8h)
  const c = chordLength;
  const h = sagittaHeight;
  const radius = (c * c + 4 * h * h) / (8 * h);

  // 🏢 ADR-065: Use centralized getUnitVector for normalized direction
  // Note: sagittaHeight check above ensures we don't divide by zero
  const unit = getUnitVector(midpoint, sagittaPoint);

  // Center is on the perpendicular bisector of the chord
  // Distance from midpoint to center = radius - sagitta_height
  // Direction: from midpoint towards sagitta point, then continue
  const centerDistance = radius - h;

  // Center is on the OPPOSITE side of the sagitta from the arc
  // So we move from midpoint in the direction of sagitta, then continue past it
  const center: Point2D = {
    x: midpoint.x - unit.x * centerDistance,
    y: midpoint.y - unit.y * centerDistance
  };

  return { center, radius };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate circle from 2 points + radius indicator - ADR-083
 *
 * Two points define where the circle passes through.
 * The third point indicates which side of the chord the center should be on,
 * and its perpendicular distance from the chord determines the effective radius.
 *
 * @param p1 - First point on the circle's circumference
 * @param p2 - Second point on the circle's circumference
 * @param radiusIndicator - Point indicating center side and radius
 * @returns Circle definition with center and radius, or null if invalid
 */
export function circleFrom2PointsAndRadius(
  p1: Point2D,
  p2: Point2D,
  radiusIndicator: Point2D
): { center: Point2D; radius: number } | null {
  // Calculate chord midpoint and length
  const midpoint = calculateMidpoint(p1, p2);
  const chordLength = calculateDistance(p1, p2);

  // 🏢 ADR-079: Use centralized tolerance
  if (chordLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Points are too close
  }

  // Half chord length
  const halfChord = chordLength / 2;

  // Calculate the perpendicular distance from midpoint to radiusIndicator
  // First, find the chord direction vector (normalized)
  const chordDx = p2.x - p1.x;
  const chordDy = p2.y - p1.y;
  const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy);

  // Perpendicular direction (rotated 90 degrees)
  const perpX = -chordDy / chordLen;
  const perpY = chordDx / chordLen;

  // Vector from midpoint to radiusIndicator
  const toIndicatorX = radiusIndicator.x - midpoint.x;
  const toIndicatorY = radiusIndicator.y - midpoint.y;

  // Project onto perpendicular to get signed distance (h)
  // This determines which side of the chord and how far
  const h = toIndicatorX * perpX + toIndicatorY * perpY;

  // 🏢 ADR-079: If h is too small, use minimum offset
  const minH = GEOMETRY_PRECISION.POINT_MATCH;
  const effectiveH = Math.abs(h) < minH ? (h >= 0 ? minH : -minH) : h;

  // Calculate radius using the relationship:
  // For a chord of length c and center distance h from the midpoint,
  // the radius r can be found using: r² = h² + (c/2)²
  // But we also know the circle passes through both points, so:
  // r = (c²/8h) + (h/2) when h is the sagitta
  //
  // Actually, for 2P + radius style, we interpret the indicator distance differently:
  // The indicator point shows where we want the arc's bulge to be.
  // We use the chord-sagitta formula: r = (c² + 4h²) / (8|h|)
  const absH = Math.abs(effectiveH);
  const radius = (chordLength * chordLength + 4 * absH * absH) / (8 * absH);

  // Calculate center position
  // Center is on the perpendicular bisector of the chord
  // Distance from midpoint = radius - |h| (towards the indicator for small h)
  // Or distance from midpoint in the direction of indicator
  const centerOffset = radius - absH;

  // Direction: same sign as h
  const directionSign = effectiveH >= 0 ? 1 : -1;

  const center: Point2D = {
    x: midpoint.x + perpX * directionSign * centerOffset,
    y: midpoint.y + perpY * directionSign * centerOffset
  };

  return { center, radius };
}

// ===== PERPENDICULAR & PARALLEL LINE CONSTRUCTION =====
// 🏢 ADR-060: Line Construction Tools (Perpendicular & Parallel) (2026-01-31)

/**
 * 🏢 ENTERPRISE (2026-01-31): Create a perpendicular line through a point - ADR-060
 *
 * Given a reference line and a through-point, creates a line perpendicular
 * to the reference that passes through (or near) the given point.
 *
 * Algorithm:
 * 1. Calculate the perpendicular direction (rotate reference direction 90°)
 * 2. Project the through-point onto the reference line
 * 3. Create a line through the projection point in the perpendicular direction
 *
 * @param refStart - Start point of reference line
 * @param refEnd - End point of reference line
 * @param throughPoint - Point that the perpendicular should pass through/near
 * @param length - Length of the resulting perpendicular line (default 100)
 * @returns Line definition with start and end points, or null if reference is degenerate
 *
 * @example
 * const perp = createPerpendicularLine(
 *   { x: 0, y: 0 }, { x: 10, y: 0 },  // Horizontal reference
 *   { x: 5, y: 3 },                    // Point above the line
 *   20                                  // 20 units long
 * );
 * // Returns line from (5, -10) to (5, 10) - vertical line at x=5
 */
export function createPerpendicularLine(
  refStart: Point2D,
  refEnd: Point2D,
  throughPoint: Point2D,
  length: number = 100
): { start: Point2D; end: Point2D } | null {
  // Calculate reference line direction
  const dx = refEnd.x - refStart.x;
  const dy = refEnd.y - refStart.y;
  const refLength = Math.sqrt(dx * dx + dy * dy);

  // 🏢 ADR-079: Use centralized tolerance
  if (refLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Reference line is degenerate (point)
  }

  // Normalized reference direction
  const refDirX = dx / refLength;
  const refDirY = dy / refLength;

  // Perpendicular direction (rotate 90° counterclockwise)
  const perpDirX = -refDirY;
  const perpDirY = refDirX;

  // Project throughPoint onto reference line to find intersection
  const toPointX = throughPoint.x - refStart.x;
  const toPointY = throughPoint.y - refStart.y;
  const projLength = toPointX * refDirX + toPointY * refDirY;

  // Intersection point (foot of perpendicular)
  const footX = refStart.x + projLength * refDirX;
  const footY = refStart.y + projLength * refDirY;

  // Create perpendicular line centered at the foot
  const halfLength = length / 2;

  return {
    start: {
      x: footX - perpDirX * halfLength,
      y: footY - perpDirY * halfLength
    },
    end: {
      x: footX + perpDirX * halfLength,
      y: footY + perpDirY * halfLength
    }
  };
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Create a parallel line at offset distance - ADR-060
 *
 * Given a reference line and an offset point, creates a line parallel
 * to the reference at the same distance as the offset point.
 *
 * Algorithm:
 * 1. Calculate perpendicular direction from reference line
 * 2. Calculate signed distance from offset point to reference line
 * 3. Create parallel line at that offset distance
 *
 * The parallel line has the same length as the reference line.
 *
 * @param refStart - Start point of reference line
 * @param refEnd - End point of reference line
 * @param offsetPoint - Point indicating which side and how far the parallel should be
 * @returns Line definition with start and end points, or null if reference is degenerate
 *
 * @example
 * const parallel = createParallelLine(
 *   { x: 0, y: 0 }, { x: 10, y: 0 },  // Horizontal reference
 *   { x: 5, y: 3 }                     // Point 3 units above
 * );
 * // Returns line from (0, 3) to (10, 3) - parallel line 3 units above
 */
export function createParallelLine(
  refStart: Point2D,
  refEnd: Point2D,
  offsetPoint: Point2D
): { start: Point2D; end: Point2D } | null {
  // Calculate reference line direction
  const dx = refEnd.x - refStart.x;
  const dy = refEnd.y - refStart.y;
  const refLength = Math.sqrt(dx * dx + dy * dy);

  // 🏢 ADR-079: Use centralized tolerance
  if (refLength < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Reference line is degenerate (point)
  }

  // Normalized reference direction
  const refDirX = dx / refLength;
  const refDirY = dy / refLength;

  // Perpendicular direction (rotate 90° counterclockwise)
  const perpDirX = -refDirY;
  const perpDirY = refDirX;

  // Calculate signed distance from offsetPoint to reference line
  // Using the perpendicular direction as normal
  const toPointX = offsetPoint.x - refStart.x;
  const toPointY = offsetPoint.y - refStart.y;
  const signedDistance = toPointX * perpDirX + toPointY * perpDirY;

  // Create parallel line by offsetting reference endpoints
  return {
    start: {
      x: refStart.x + perpDirX * signedDistance,
      y: refStart.y + perpDirY * signedDistance
    },
    end: {
      x: refEnd.x + perpDirX * signedDistance,
      y: refEnd.y + perpDirY * signedDistance
    }
  };
}

// ===== LINE INTERSECTION (INFINITE LINES) =====
// 🏢 ADR-XXX: Centralized Line Intersection for Extended Lines (2026-01-31)

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate intersection of two infinite lines
 *
 * Unlike segment intersection, this function treats lines as infinite in both directions.
 * Used for: Circle TTT (tangent to 3 lines), construction lines, projections
 *
 * Line equation: parametric form
 * Line 1: P = p1 + t*(p2-p1)
 * Line 2: P = p3 + u*(p4-p3)
 *
 * @param line1Start - Point on line 1
 * @param line1End - Another point on line 1 (defines direction)
 * @param line2Start - Point on line 2
 * @param line2End - Another point on line 2 (defines direction)
 * @returns Intersection point, or null if lines are parallel
 *
 * @example
 * const intersection = lineIntersectionExtended(
 *   { x: 0, y: 0 }, { x: 10, y: 0 },  // Horizontal line through origin
 *   { x: 5, y: -5 }, { x: 5, y: 5 }   // Vertical line at x=5
 * );
 * // Returns { x: 5, y: 0 }
 */
export function lineIntersectionExtended(
  line1Start: Point2D,
  line1End: Point2D,
  line2Start: Point2D,
  line2End: Point2D
): Point2D | null {
  const x1 = line1Start.x, y1 = line1Start.y;
  const x2 = line1End.x, y2 = line1End.y;
  const x3 = line2Start.x, y3 = line2Start.y;
  const x4 = line2End.x, y4 = line2End.y;

  // Denominator for both t and u
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // 🏢 ADR-079: Use centralized tolerance for parallel line detection
  if (Math.abs(denom) < GEOMETRY_PRECISION.COLLINEAR_TOLERANCE) {
    return null; // Lines are parallel (or coincident)
  }

  // Calculate parameter t for line 1
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  // No bounds checking - we want the intersection even if outside the segments
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

// ===== CIRCLE TANGENT TO 3 LINES (AutoCAD TTT) =====

/**
 * 🏢 ENTERPRISE (2026-01-31): Calculate circle tangent to 3 lines (AutoCAD TTT command)
 *
 * This calculates the inscribed circle (incircle) of the triangle formed by 3 lines.
 * The incircle is tangent to all 3 sides of the triangle.
 *
 * Algorithm:
 * 1. Find the 3 intersection points (triangle vertices A, B, C)
 * 2. Calculate side lengths (a, b, c opposite to vertices A, B, C)
 * 3. Calculate incenter I = (a*A + b*B + c*C) / (a+b+c)
 * 4. Calculate inradius r = Area / s (where s = semi-perimeter)
 *
 * Reference: https://en.wikipedia.org/wiki/Incircle_and_excircles_of_a_triangle
 *
 * @param line1 - First line (any two points on the line)
 * @param line2 - Second line (any two points on the line)
 * @param line3 - Third line (any two points on the line)
 * @returns Circle definition with center and radius, or null if lines don't form valid triangle
 *
 * @example
 * // Triangle formed by y=0, x=0, and x+y=10
 * const result = circleTangentTo3Lines(
 *   { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },    // y = 0
 *   { start: { x: 0, y: 0 }, end: { x: 0, y: 10 } },    // x = 0
 *   { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } }    // x + y = 10
 * );
 */
export function circleTangentTo3Lines(
  line1: { start: Point2D; end: Point2D },
  line2: { start: Point2D; end: Point2D },
  line3: { start: Point2D; end: Point2D }
): { center: Point2D; radius: number } | null {
  // Step 1: Find the 3 intersection points (triangle vertices)
  const A = lineIntersectionExtended(line1.start, line1.end, line2.start, line2.end);
  const B = lineIntersectionExtended(line2.start, line2.end, line3.start, line3.end);
  const C = lineIntersectionExtended(line3.start, line3.end, line1.start, line1.end);

  // Validate all intersections exist (lines are not all parallel)
  if (!A || !B || !C) {
    return null; // At least two lines are parallel - no valid triangle
  }

  // 🏢 ADR-079: Check if points are coincident (degenerate triangle)
  if (calculateDistance(A, B) < GEOMETRY_PRECISION.POINT_MATCH ||
      calculateDistance(B, C) < GEOMETRY_PRECISION.POINT_MATCH ||
      calculateDistance(C, A) < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Degenerate triangle (lines pass through same point)
  }

  // Step 2: Calculate side lengths
  // Side a is opposite to vertex A (between B and C)
  // Side b is opposite to vertex B (between C and A)
  // Side c is opposite to vertex C (between A and B)
  const a = calculateDistance(B, C);
  const b = calculateDistance(C, A);
  const c = calculateDistance(A, B);

  // Step 3: Calculate incenter using weighted average
  // I = (a*A + b*B + c*C) / (a + b + c)
  const perimeter = a + b + c;

  // 🏢 ADR-079: Validate perimeter
  if (perimeter < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Triangle too small
  }

  const center: Point2D = {
    x: (a * A.x + b * B.x + c * C.x) / perimeter,
    y: (a * A.y + b * B.y + c * C.y) / perimeter
  };

  // Step 4: Calculate inradius using Heron's formula
  // Area = sqrt(s * (s-a) * (s-b) * (s-c)) where s = semi-perimeter
  // r = Area / s
  const s = perimeter / 2;
  const areaSquared = s * (s - a) * (s - b) * (s - c);

  // 🏢 ADR-079: Validate area (check for degenerate/collinear case)
  if (areaSquared <= 0) {
    return null; // Degenerate triangle (collinear points)
  }

  const area = Math.sqrt(areaSquared);
  const radius = area / s;

  // 🏢 ADR-079: Validate radius
  if (radius < GEOMETRY_PRECISION.POINT_MATCH) {
    return null; // Radius too small
  }

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
  let angleDiff = endAngleRad - startAngleRad;
  // Normalize to (-π, π] to find the "short" direction
  while (angleDiff > Math.PI) angleDiff -= TAU;
  while (angleDiff <= -Math.PI) angleDiff += TAU;

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
// 🏢 ADR-077: TAU imported from canvasPaths.ts (see imports at top)

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