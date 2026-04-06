/**
 * GEOMETRY CIRCLE UTILITIES
 * ADR-065: Extracted from geometry-utils.ts — Circle construction, line intersection, TTT
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
// 🏢 ADR-073: Centralized Midpoint Calculation
// 🏢 ADR-090: Centralized Point Vector Operations
// 🏢 ADR-164: Centralized Perpendicular Unit Vector
import { calculateDistance, calculateMidpoint, getUnitVector, getPerpendicularUnitVector } from './geometry-rendering-utils';
// 🏢 ADR-079: Centralized Geometric Precision Constants & Utility Functions
import {
  GEOMETRY_PRECISION,
  isDenominatorZero,
  isCollinear
} from '../../../config/tolerance-config';

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
  // 🏢 ADR-079: Use centralized precision check function
  if (isDenominatorZero(det)) {
    // Fallback: Use simple centroid method
    // Calculate center as centroid and radius as average distance
    // 🏢 ADR-065: Use centralized distance calculation
    let totalDist = 0;
    for (const p of points) {
      totalDist += calculateDistance(p, { x: meanX, y: meanY });
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

  // 🏢 ADR-079: Use centralized precision check function
  if (isCollinear(d)) {
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

  // 🏢 ADR-164: Use centralized perpendicular unit vector
  const perp = getPerpendicularUnitVector(p1, p2);
  const perpX = perp.x;
  const perpY = perp.y;

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
  // Suppress unused variable warning — halfChord is part of the geometric derivation
  void halfChord;

  const center: Point2D = {
    x: midpoint.x + perpX * directionSign * centerOffset,
    y: midpoint.y + perpY * directionSign * centerOffset
  };

  return { center, radius };
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

  // 🏢 ADR-079: Use centralized precision check function
  if (isCollinear(denom)) {
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
