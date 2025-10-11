/**
 * 🔧 POLYGON UTILITIES
 *
 * Utility functions για polygon operations
 *
 * @module core/polygon-system/utils/polygon-utils
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonValidationResult
} from '../types';

/**
 * Validate polygon structure and geometry
 */
export function validatePolygon(polygon: UniversalPolygon): PolygonValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Basic structure validation
  if (!polygon.id) {
    errors.push('Polygon must have an ID');
  }

  if (!polygon.points || !Array.isArray(polygon.points)) {
    errors.push('Polygon must have points array');
    return { isValid: false, errors, warnings, suggestions };
  }

  if (polygon.points.length < 2) {
    errors.push('Polygon must have at least 2 points');
  }

  // Point validation
  for (let i = 0; i < polygon.points.length; i++) {
    const point = polygon.points[i];

    if (typeof point.x !== 'number' || typeof point.y !== 'number') {
      errors.push(`Point ${i}: Invalid coordinates`);
    }

    if (isNaN(point.x) || isNaN(point.y)) {
      errors.push(`Point ${i}: NaN coordinates`);
    }

    if (!isFinite(point.x) || !isFinite(point.y)) {
      errors.push(`Point ${i}: Infinite coordinates`);
    }
  }

  // Geometric validation
  if (polygon.points.length >= 3) {
    // Check for duplicate consecutive points
    for (let i = 0; i < polygon.points.length - 1; i++) {
      const current = polygon.points[i];
      const next = polygon.points[i + 1];

      if (Math.abs(current.x - next.x) < 0.001 && Math.abs(current.y - next.y) < 0.001) {
        warnings.push(`Duplicate consecutive points at index ${i}-${i + 1}`);
        suggestions.push('Remove duplicate points');
      }
    }

    // Check for self-intersection (basic check)
    if (polygon.points.length >= 4 && polygon.isClosed) {
      const hasIntersection = checkSelfIntersection(polygon.points);
      if (hasIntersection) {
        warnings.push('Polygon may have self-intersections');
        suggestions.push('Check polygon geometry');
      }
    }

    // Check polygon area
    const area = calculatePolygonArea(polygon);
    if (Math.abs(area) < 0.001) {
      warnings.push('Polygon has very small or zero area');
    }
  }

  // Closure validation
  if (polygon.isClosed && polygon.points.length >= 3) {
    const firstPoint = polygon.points[0];
    const lastPoint = polygon.points[polygon.points.length - 1];

    if (Math.abs(firstPoint.x - lastPoint.x) > 0.001 ||
        Math.abs(firstPoint.y - lastPoint.y) > 0.001) {
      warnings.push('Polygon marked as closed but first/last points differ');
      suggestions.push('Update closure status or fix coordinates');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Calculate polygon area (signed area)
 */
export function calculatePolygonArea(polygon: UniversalPolygon): number {
  const points = polygon.points;

  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate polygon perimeter
 */
export function calculatePolygonPerimeter(polygon: UniversalPolygon): number {
  const points = polygon.points;

  if (points.length < 2) {
    return 0;
  }

  let perimeter = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    perimeter += Math.sqrt(
      Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)
    );
  }

  // Add closing edge if polygon is closed
  if (polygon.isClosed && points.length >= 3) {
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    perimeter += Math.sqrt(
      Math.pow(firstPoint.x - lastPoint.x, 2) + Math.pow(firstPoint.y - lastPoint.y, 2)
    );
  }

  return perimeter;
}

/**
 * Check if polygon is closed
 */
export function isPolygonClosed(polygon: UniversalPolygon): boolean {
  if (polygon.points.length < 3) {
    return false;
  }

  const firstPoint = polygon.points[0];
  const lastPoint = polygon.points[polygon.points.length - 1];

  const isClosed = Math.abs(firstPoint.x - lastPoint.x) < 0.001 &&
                   Math.abs(firstPoint.y - lastPoint.y) < 0.001;

  return isClosed;
}

/**
 * Close polygon by adding first point as last point
 */
export function closePolygon(polygon: UniversalPolygon): UniversalPolygon {
  if (polygon.points.length < 3) {
    console.warn('⚠️ Cannot close polygon with less than 3 points');
    return polygon;
  }

  if (polygon.isClosed) {
    return polygon; // Already closed
  }

  const firstPoint = polygon.points[0];
  const lastPoint = polygon.points[polygon.points.length - 1];

  // Check if already geometrically closed
  const isGeometricallyClosedÖ = Math.abs(firstPoint.x - lastPoint.x) < 0.001 &&
                                 Math.abs(firstPoint.y - lastPoint.y) < 0.001;

  if (!isGeometricallyClosedÖ) {
    // Add closing point
    polygon.points.push({
      ...firstPoint,
      id: `closing_point_${Date.now()}`,
      label: 'Closing Point'
    });
  }

  // Mark as closed
  polygon.isClosed = true;
  polygon.metadata = {
    createdAt: polygon.metadata?.createdAt || new Date(),
    modifiedAt: new Date(),
    ...polygon.metadata
  };

  return polygon;
}

/**
 * Get polygon bounding box
 */
export function getPolygonBounds(polygon: UniversalPolygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (polygon.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = polygon.points[0].x;
  let minY = polygon.points[0].y;
  let maxX = polygon.points[0].x;
  let maxY = polygon.points[0].y;

  for (let i = 1; i < polygon.points.length; i++) {
    const point = polygon.points[i];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Check if point is inside polygon (ray casting algorithm)
 */
export function isPointInPolygon(point: PolygonPoint, polygon: UniversalPolygon): boolean {
  if (!polygon.isClosed || polygon.points.length < 3) {
    return false;
  }

  const { x, y } = point;
  const points = polygon.points;
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Simple self-intersection check
 */
function checkSelfIntersection(points: PolygonPoint[]): boolean {
  if (points.length < 4) {
    return false;
  }

  // Check each edge against every other non-adjacent edge
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      // Skip adjacent edges
      if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 2)) {
        continue;
      }

      const edge1Start = points[i];
      const edge1End = points[i + 1];
      const edge2Start = points[j];
      const edge2End = points[j + 1];

      if (doLinesIntersect(edge1Start, edge1End, edge2Start, edge2End)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if two line segments intersect
 */
function doLinesIntersect(
  p1: PolygonPoint,
  p2: PolygonPoint,
  p3: PolygonPoint,
  p4: PolygonPoint
): boolean {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (Math.abs(denom) < 0.001) {
    return false; // Lines are parallel
  }

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Simplify polygon using Douglas-Peucker algorithm
 */
export function simplifyPolygon(polygon: UniversalPolygon, tolerance: number = 1.0): UniversalPolygon {
  if (polygon.points.length <= 2) {
    return polygon;
  }

  const simplifiedPoints = douglasPeucker(polygon.points, tolerance);

  return {
    ...polygon,
    points: simplifiedPoints,
    metadata: {
      createdAt: polygon.metadata?.createdAt || new Date(),
      modifiedAt: new Date(),
      ...polygon.metadata
    }
  };
}

/**
 * Douglas-Peucker line simplification algorithm
 */
function douglasPeucker(points: PolygonPoint[], tolerance: number): PolygonPoint[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with maximum distance from line
  let maxDistance = 0;
  let maxIndex = 0;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointToLineDistance(points[i], firstPoint, lastPoint);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftSide = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const rightSide = douglasPeucker(points.slice(maxIndex), tolerance);

    // Merge results (remove duplicate point at junction)
    return leftSide.slice(0, -1).concat(rightSide);
  } else {
    // All points between first and last are within tolerance
    return [firstPoint, lastPoint];
  }
}

/**
 * Calculate perpendicular distance from point to line
 */
function pointToLineDistance(
  point: PolygonPoint,
  lineStart: PolygonPoint,
  lineEnd: PolygonPoint
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    // Line start and end are the same point
    return Math.sqrt(A * A + B * B);
  }

  const param = dot / lenSq;

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}