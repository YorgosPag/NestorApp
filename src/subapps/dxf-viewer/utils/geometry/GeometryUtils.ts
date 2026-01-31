/**
 * Geometry utilities for DXF entity processing
 * Handles arc tessellation, segment chaining, and geometric calculations
 */

import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-067: Centralized angle conversion + TAU constant
import { degToRad, TAU } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-102: Centralized Entity Type Guards
import {
  isLineEntity,
  isPolylineEntity,
  isArcEntity,
  type Entity,
} from '../../types/entities';
// 🏢 ADR-074: Centralized Point On Circle
import { pointOnCircle } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-079: Centralized Geometric Precision Constants
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';

export const GEOMETRY_CONSTANTS = {
  // 🏢 ADR-079: Using centralized precision constants
  EPS: GEOMETRY_PRECISION.ENTITY_GAP, // Relaxed tolerance for better entity matching (1e-3)
  GAP_TOLERANCE: 0.5, // Allow moderate gaps between entities (CAD units)
  DEFAULT_ARC_SEGMENTS: 24
} as const;

// Point2D imported from shared types

export interface Segment {
  start: Point2D;
  end: Point2D;
}

export interface Arc {
  center: Point2D;
  radius: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Check if two numbers are approximately equal
 */
export function approximatelyEqual(a: number, b: number, tolerance = GEOMETRY_CONSTANTS.EPS): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Check if two points are the same within tolerance
 */
export function samePoint(p: Point2D, q: Point2D): boolean {
  return approximatelyEqual(p.x, q.x) && approximatelyEqual(p.y, q.y);
}

/**
 * Check if two points are near each other within gap tolerance
 */
export function nearPoint(p: Point2D, q: Point2D): boolean {
  const dist = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  return dist <= GEOMETRY_CONSTANTS.GAP_TOLERANCE;
}

/**
 * Calculate distance between two points
 * ✅ CENTRALIZED: Re-export από centralized location
 */
export { calculateDistance as distance } from '../../rendering/entities/shared/geometry-rendering-utils';

/**
 * Convert arc to polyline vertices
 */
export function arcToPolyline(arc: Arc, segments: number = GEOMETRY_CONSTANTS.DEFAULT_ARC_SEGMENTS): Point2D[] {
  if (!arc.center || typeof arc.radius !== 'number') return [];

  const { center, radius } = arc;

  // DXF angles are in DEGREES (counter-clockwise). Convert to RADIANS.
  // 🏢 ADR-067: Using centralized degToRad from geometry-utils
  let start = degToRad(arc.startAngle ?? 0);
  let end = degToRad(arc.endAngle ?? 0);

  // Normalize to ensure end > start within [0, 2π)
  // 🏢 TAU imported from centralized geometry-utils
  start = ((start % TAU) + TAU) % TAU;
  end = ((end % TAU) + TAU) % TAU;
  if (end <= start) end += TAU;

  const span = end - start;
  const steps = Math.max(2, segments);
  const step = span / steps;

  const verts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + i * step;
    // 🏢 ADR-074: Use centralized pointOnCircle
    const point = pointOnCircle(center, radius, a);

    // 🏢 ADR-079: Drop consecutive duplicates using centralized vertex duplicate threshold
    if (verts.length === 0 || Math.hypot(point.x - verts[verts.length - 1].x, point.y - verts[verts.length - 1].y) > GEOMETRY_PRECISION.VERTEX_DUPLICATE) {
      verts.push(point);
    }
  }

  if (verts.length > 0) {

  }
  
  return verts;
}

/**
 * Base entity interface for geometry processing
 */
interface GeometryEntity {
  type: string;
  start?: Point2D;
  end?: Point2D;
  vertices?: Point2D[];
  closed?: boolean;
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Convert entity to segments based on type
 */
export function entityToSegments(entity: GeometryEntity): Segment[] {
  // 🏢 ADR-102: Use centralized type guards (cast GeometryEntity to Entity for compatibility)
  const e = entity as unknown as Entity;

  if (isLineEntity(e)) {
    // Type guard: Ensure start and end exist on line entity
    if (!entity.start || !entity.end) return [];
    return [{ start: entity.start, end: entity.end }];
  }

  if (isPolylineEntity(e)) {
    const vs = entity.vertices || [];
    const segs: Segment[] = [];
    
    for (let i = 0; i < vs.length - 1; i++) {
      segs.push({ start: vs[i], end: vs[i + 1] });
    }
    
    if (entity.closed && vs.length > 2) {
      segs.push({ start: vs[vs.length - 1], end: vs[0] });
    }
    
    return segs;
  }

  if (isArcEntity(e)) {
    // Type guard: Ensure required arc properties exist
    if (!entity.center || typeof entity.radius !== 'number') return [];
    const vertices = arcToPolyline(entity as Arc);
    const segs: Segment[] = [];
    
    for (let i = 0; i < vertices.length - 1; i++) {
      segs.push({ start: vertices[i], end: vertices[i + 1] });
    }
    
    return segs;
  }
  
  return [];
}

/**
 * 🎯 CENTRALIZED POINT-IN-POLYGON TEST
 * Κεντρικοποιημένη μέθοδος για έλεγχο αν σημείο είναι μέσα σε πολύγωνο
 * Χρησιμοποιείται από selection systems, hit testing, και layer rendering
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * 🎯 CENTRALIZED BOUNDS CALCULATION FROM VERTICES
 * Κεντρικοποιημένη μέθοδος για υπολογισμό bounds από vertices
 */
export function calculateVerticesBounds(vertices: Point2D[]): { min: Point2D; max: Point2D } | null {
  if (!vertices || vertices.length === 0) return null;

  let minX = vertices[0].x, minY = vertices[0].y;
  let maxX = minX, maxY = minY;

  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

/**
 * Debug helper to log segment endpoints
 */
export function debugSegments(segs: Segment[], label: string): void {

  segs.forEach((seg, i) => {

  });
}