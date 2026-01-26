/**
 * UNIFIED GEOMETRY UTILITIES
 * ✅ ΕΝΟΠΟΙΗΜΕΝΟ: Κοινές γεωμετρικές λειτουργίες για όλους τους renderers
 * Συνδυάζει όλα τα geometry utilities σε ένα αρχείο
 */

import type { Point2D, BoundingBox } from '../../types/Types';
import { calculateDistance } from './geometry-rendering-utils';

// ===== DISTANCE CALCULATIONS =====

// Διαγράφηκε το διπλότυπο pointDistance - χρησιμοποιείστε calculateDistance από geometry-rendering-utils

/**
 * Calculate distance from a point to a line segment
 * Used in hit testing across multiple renderers
 */
export function pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const nearestPoint = getNearestPointOnLine(point, lineStart, lineEnd, true);
  const dx = point.x - nearestPoint.x;
  const dy = point.y - nearestPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
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
  const length = Math.sqrt(dx * dx + dy * dy);

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

// ===== ANGLE CALCULATIONS =====

/**
 * Calculate angle between two vectors from a common point
 */
export function angleBetweenPoints(vertex: Point2D, point1: Point2D, point2: Point2D): number {
  const v1 = { x: point1.x - vertex.x, y: point1.y - vertex.y };
  const v2 = { x: point2.x - vertex.x, y: point2.y - vertex.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

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
  // Normalize angles to [0, 2π]
  const normalizeAngle = (a: number) => {
    while (a < 0) a += 2 * Math.PI;
    while (a >= 2 * Math.PI) a -= 2 * Math.PI;
    return a;
  };

  const testAngle = normalizeAngle(angle);
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);

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

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * 180 / Math.PI;
}