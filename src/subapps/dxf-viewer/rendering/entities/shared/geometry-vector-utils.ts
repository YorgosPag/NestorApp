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
