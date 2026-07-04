/**
 * Geometry vector & math utilities
 * Extracted from geometry-rendering-utils.ts for SRP (ADR-065)
 *
 * Contains pure mathematical operations:
 * - Distance calculations (Euclidean, squared)
 * - Vector operations (magnitude, normalize, unit, perpendicular)
 * - Dot product, angle calculations
 * - Point arithmetic (add, subtract, scale, offset, midpoint)
 * - Point on circle (polar to cartesian)
 */

import type { Point2D } from '../../types/Types';

// ===== DISTANCE =====

/**
 * Calculate Euclidean distance between two points.
 * Used by: snap engines, grips, drawing hooks, hit testing.
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (without sqrt).
 * Use for comparisons and threshold checks where actual distance not needed.
 * ADR-109: Centralized Squared Distance.
 */
export function squaredDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Structural equality for two Point2D values (or null).
 * Use instead of inline `a.x === b.x && a.y === b.y` guards.
 */
export function pointsEqual(
  a: Point2D | null | undefined,
  b: Point2D | null | undefined,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return a.x === b.x && a.y === b.y;
}

// ===== VECTOR MAGNITUDE & NORMALIZATION =====

/**
 * Calculate the magnitude (length) of a 2D vector.
 * ADR-070: Centralized Vector Magnitude.
 */
export function vectorMagnitude(vector: Point2D): number {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

/**
 * Normalize a vector to unit length.
 * Returns zero vector if input length is 0.
 */
export function normalizeVector(vector: Point2D): Point2D {
  const length = vectorMagnitude(vector);
  if (length === 0) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

/**
 * Calculate unit vector from one point to another.
 */
export function getUnitVector(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return normalizeVector({ x: dx, y: dy });
}

/**
 * Get perpendicular unit vector (rotated 90deg counter-clockwise).
 * For vector (x, y), perpendicular is (-y, x).
 */
export function getPerpendicularUnitVector(from: Point2D, to: Point2D): Point2D {
  const unit = getUnitVector(from, to);
  return { x: -unit.y, y: unit.x };
}

// ===== DOT PRODUCT =====

/**
 * Calculate the dot product of two 2D vectors.
 * ADR-072: Centralized Dot Product.
 *
 * Properties: v1.v2 = |v1|*|v2|*cos(theta)
 * - If dot = 0 => perpendicular
 * - If dot > 0 => angle < 90deg
 * - If dot < 0 => angle > 90deg
 */
export function dotProduct(v1: Point2D, v2: Point2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Signed perpendicular distance of `point` from the infinite line through
 * `a → b`. Sign follows the CCW perpendicular unit vector (`getPerpendicularUnitVector`):
 * positive = left of travel `a→b`, negative = right. Zero for a degenerate line.
 *
 * SSoT for the "which side + how far" probe used by the OFFSET tool (ADR-510 Φ4d)
 * and the existing parallel-line math (`createParallelLine` inlines this same
 * dot-against-normal formula — a future ratchet can fold it onto this helper).
 */
export function signedDistanceToLine(point: Point2D, a: Point2D, b: Point2D): number {
  const perp = getPerpendicularUnitVector(a, b);
  if (perp.x === 0 && perp.y === 0) return 0;
  return dotProduct(subtractPoints(point, a), perp);
}

/**
 * Intersection of the two INFINITE lines through (a1,a2) and (b1,b2); null when the
 * directions are parallel/degenerate (denominator ≈ 0).
 *
 * SSoT for line–line intersection — used by the OFFSET miter reconciliation
 * (`systems/offset/offset-polyline.ts`) and the FILLET/CHAMFER corner math
 * (`systems/corner/corner-math.ts`, ADR-510 Φ4e). Solves for `t` along `a1→a2`.
 */
export function infiniteLineIntersection(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): Point2D | null {
  const dax = a2.x - a1.x, day = a2.y - a1.y;
  const dbx = b2.x - b1.x, dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  return { x: a1.x + dax * t, y: a1.y + day * t };
}

/**
 * Intersections of the INFINITE line through `a→b` with the circle (`center`, `radius`).
 * Returns 0, 1 (tangent) or 2 points. Unlike `GeometricCalculations.getLineCircleIntersections`
 * (which clamps `t∈[0,1]` to the SEGMENT), this treats the line as infinite — required by the
 * FILLET curve solver where each entity is offset to an infinite center-locus (ADR-510 Φ4e.2).
 */
export function infiniteLineCircleIntersections(
  a: Point2D,
  b: Point2D,
  center: Point2D,
  radius: number,
): Point2D[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - center.x, fy = a.y - center.y;
  const A = dx * dx + dy * dy;
  if (A < 1e-18) return [];
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radius * radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sq = Math.sqrt(disc);
  const t1 = (-B - sq) / (2 * A);
  const pts: Point2D[] = [{ x: a.x + t1 * dx, y: a.y + t1 * dy }];
  if (disc > 1e-12) {
    const t2 = (-B + sq) / (2 * A);
    pts.push({ x: a.x + t2 * dx, y: a.y + t2 * dy });
  }
  return pts;
}

// ===== POINT ON CIRCLE =====

/**
 * Calculate a point on a circle circumference given center, radius, and angle.
 * ADR-074: Centralized Point On Circle.
 *
 * @param angle - Angle in radians (0 = right, pi/2 = up)
 */
export function pointOnCircle(center: Point2D, radius: number, angle: number): Point2D {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle)
  };
}

// ===== VECTOR ARITHMETIC =====

/**
 * Subtract two points (creates vector from p2 to p1).
 * ADR-090: Centralized Point Vector Operations.
 */
export function subtractPoints(p1: Point2D, p2: Point2D): Point2D {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

/**
 * Add two points/vectors (component-wise).
 */
export function addPoints(p1: Point2D, p2: Point2D): Point2D {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

/**
 * Scale a point/vector by a scalar (component-wise multiplication).
 */
export function scalePoint(point: Point2D, scalar: number): Point2D {
  return { x: point.x * scalar, y: point.y * scalar };
}

/**
 * Scale an ARRAY of points/vectors by a scalar, preserving each element's extra
 * fields (e.g. `z` on a Point3D). The array sibling of {@link scalePoint}.
 * SSoT for the `pts.map(p => ({ ...p, x: p.x*k, y: p.y*k }))` idiom — e.g. the
 * ADR-462 canvas-units → world-metres plan scaling across the BIM 3D converters.
 */
export function scalePoints<T extends Point2D>(points: readonly T[], scalar: number): T[] {
  return points.map((p) => ({ ...p, x: p.x * scalar, y: p.y * scalar }));
}

/**
 * Offset a point by a direction vector scaled by distance.
 * Equivalent to: point + direction * distance.
 */
export function offsetPoint(point: Point2D, direction: Point2D, distance: number): Point2D {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance
  };
}

/**
 * Επανατοποθετεί το `end` ώστε το ευθύγραμμο τμήμα `start→end` να έχει ακριβώς `length` (διατηρώντας τη
 * φορά). Εκφυλισμένο (`start≈end`) → +X (ντετερμινιστικό). **SSoT** για το «μετακίνησε το άκρο σε δοθέν
 * μήκος κατά μήκος της διεύθυνσης», που πριν ήταν αντιγραμμένο ως min-clamp (wall preview) και max-clamp
 * (line ghost stub). Ο caller κρατά τη δική του συνθήκη clamp (≥min ή ≤max) — εδώ ζει μόνο η γεωμετρία.
 */
export function resizeSegmentToLength(start: Point2D, end: Point2D, length: number): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cur = Math.hypot(dx, dy);
  const ux = cur > 1e-9 ? dx / cur : 1;
  const uy = cur > 1e-9 ? dy / cur : 0;
  return { x: start.x + ux * length, y: start.y + uy * length };
}

/**
 * Calculate midpoint between two points.
 */
export function calculateMidpoint(point1: Point2D, point2: Point2D): Point2D {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
}

// ===== ANGLE FUNCTIONS =====

/**
 * Calculate angle between two points (in radians).
 */
export function calculateAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Calculate the angle of a 2D vector from the positive X-axis (in radians).
 * ADR-078: Centralized Vector Angle.
 *
 * NOTE: Differs from calculateAngle() — this takes a single vector, not two points.
 * @returns Angle in radians, range [-pi, pi]
 */
export function vectorAngle(vector: Point2D): number {
  return Math.atan2(vector.y, vector.x);
}

/**
 * Calculate the signed angle between two 2D vectors (in radians).
 * ADR-078: Centralized Angle Between Vectors.
 *
 * Uses atan2(cross, dot) formula.
 * Positive = CCW from v1 to v2, Negative = CW.
 * Range: [-pi, pi]
 */
export function angleBetweenVectors(v1: Point2D, v2: Point2D): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  return Math.atan2(cross, dot);
}

/**
 * Rotate a point around another point.
 */
export function rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  };
}

/**
 * Calculate perpendicular direction vector (optionally normalized).
 */
export function getPerpendicularDirection(from: Point2D, to: Point2D, normalize = true): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  let perpX = -dy;
  let perpY = dx;

  if (normalize) {
    const length = Math.sqrt(perpX * perpX + perpY * perpY);
    if (length > 0) {
      perpX /= length;
      perpY /= length;
    }
  }

  return { x: perpX, y: perpY };
}
