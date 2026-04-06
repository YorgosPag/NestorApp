/**
 * GEOMETRY POLYLINE UTILITIES
 * ADR-065: Extracted from geometry-utils.ts — Polyline/polygon calculations
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from './geometry-rendering-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { ZERO_VECTOR } from '../../../config/geometry-constants';

// ===== DISTANCE TO LINE (needed by simplifyPolyline) =====

/**
 * Get nearest point on a line segment (local helper to avoid circular dependency)
 */
function getNearestPointOnSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): Point2D {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
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
  const clampedProjection = Math.max(0, Math.min(projection, length));

  return {
    x: lineStart.x + clampedProjection * normalizedDx,
    y: lineStart.y + clampedProjection * normalizedDy
  };
}

/**
 * Calculate distance from a point to a line segment (local helper for simplifyPolyline)
 */
function pointToSegmentDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const nearestPoint = getNearestPointOnSegment(point, lineStart, lineEnd);
  return calculateDistance(point, nearestPoint);
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
  // 🏢 ADR-118: Use centralized ZERO_VECTOR for empty array fallback
  if (points.length === 0) return ZERO_VECTOR;
  if (points.length === 1) return { ...points[0] };

  // 🎯 FIX (2026-02-13): Χρήση SIGNED area αντί absolute — ο τύπος centroid
  // απαιτεί signed area για σωστό πρόσημο. Με abs area, CW-wound polygons
  // (κανονική φορά στο canvas Y-down) δίνουν centroid σε αντίθετη θέση (off-screen).
  let signedArea2 = 0; // = 2 × signed area
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    signedArea2 += points[i].x * points[j].y - points[j].x * points[i].y;
  }

  if (Math.abs(signedArea2) < 1e-10) {
    // Degenerate polygon - return average of points
    // 🏢 ADR-118: Use centralized ZERO_VECTOR for accumulator initialization
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { ...ZERO_VECTOR });
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

  // factor = 1/(6A) = 1/(6 × signedArea2/2) = 1/(3 × signedArea2)
  const factor = 1 / (3 * signedArea2);
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

  const simplifyRecursive = (pts: Point2D[], first: number, last: number, tol: number): Point2D[] => {
    if (last - first <= 1) return [pts[first], pts[last]];

    let maxDistance = 0;
    let maxIndex = first;

    for (let i = first + 1; i < last; i++) {
      const distance = pointToSegmentDistance(pts[i], pts[first], pts[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tol) {
      const left = simplifyRecursive(pts, first, maxIndex, tol);
      const right = simplifyRecursive(pts, maxIndex, last, tol);
      return [...left.slice(0, -1), ...right];
    } else {
      return [pts[first], pts[last]];
    }
  };

  return simplifyRecursive(points, 0, points.length - 1, tolerance);
}
