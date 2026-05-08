/**
 * =============================================================================
 * Overlay Hit-Test — Multi-Kind Geometry Dispatch
 * =============================================================================
 *
 * Per-geometry hit-testing for `FloorplanOverlay` shapes (Phase 9 STEP F).
 * Splits the legacy polygon-only `isPointInPolygon` path into a dispatch on
 * `geometry.type`:
 *   - polygon (closed) → ray-cast via `isPointInPolygon`
 *   - polygon (open)   → distance to polyline ≤ tolerance
 *   - line             → distance to segment ≤ tolerance
 *   - circle           → |point − center| ≤ radius + tolerance
 *   - arc              → distance to circle ≤ tolerance (v1: angle range
 *                        approximated as full circle — narrow arcs land in
 *                        AABB pre-filter regardless)
 *   - dimension        → line treatment between from/to
 *   - measurement      → polyline distance per mode (distance/area/angle)
 *   - text             → AABB around `position`
 *
 * `computeGeometryAABB` returns the axis-aligned bounding box in world
 * coordinates for the AABB pre-filter.
 *
 * @module components/shared/files/media/overlay-hit-test
 * @enterprise ADR-340 §3.6 / Phase 9 STEP F
 */

import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';
import type {
  OverlayGeometry,
  Point2D,
} from '@/types/floorplan-overlays';

/** AABB box in world coordinates. */
export interface GeometryAABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Default hit-test tolerance (world units). Caller can override. */
export const DEFAULT_HIT_TOLERANCE = 1;

const TEXT_AABB_HALF = 1;

// ============================================================================
// AABB
// ============================================================================

export function computeGeometryAABB(geometry: OverlayGeometry): GeometryAABB {
  switch (geometry.type) {
    case 'polygon':
      return aabbFromPoints(geometry.vertices);
    case 'line':
      return aabbFromPoints([geometry.start, geometry.end]);
    case 'circle':
      return circleAABB(geometry.center, geometry.radius);
    case 'arc':
      return circleAABB(geometry.center, geometry.radius);
    case 'dimension':
      return aabbFromPoints([geometry.from, geometry.to]);
    case 'measurement':
      return aabbFromPoints(geometry.points);
    case 'text':
      return {
        minX: geometry.position.x - TEXT_AABB_HALF,
        minY: geometry.position.y - TEXT_AABB_HALF,
        maxX: geometry.position.x + TEXT_AABB_HALF,
        maxY: geometry.position.y + TEXT_AABB_HALF,
      };
  }
}

function aabbFromPoints(points: ReadonlyArray<Point2D>): GeometryAABB {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function circleAABB(center: Point2D, radius: number): GeometryAABB {
  return {
    minX: center.x - radius,
    minY: center.y - radius,
    maxX: center.x + radius,
    maxY: center.y + radius,
  };
}

// ============================================================================
// HIT-TEST DISPATCH
// ============================================================================

/**
 * Returns true if the world-space `point` hits the geometry within
 * `tolerance` (world units; default `DEFAULT_HIT_TOLERANCE`).
 */
export function hitTestGeometry(
  point: Point2D,
  geometry: OverlayGeometry,
  overlayId: string,
  tolerance: number = DEFAULT_HIT_TOLERANCE,
): boolean {
  switch (geometry.type) {
    case 'polygon':
      return hitPolygon(point, geometry.vertices, geometry.closed ?? true, overlayId, tolerance);
    case 'line':
      return distanceToSegment(point, geometry.start, geometry.end) <= tolerance;
    case 'circle':
      return Math.abs(distance(point, geometry.center) - geometry.radius) <= tolerance;
    case 'arc':
      return Math.abs(distance(point, geometry.center) - geometry.radius) <= tolerance;
    case 'dimension':
      return distanceToSegment(point, geometry.from, geometry.to) <= tolerance;
    case 'measurement':
      return hitPolyline(point, geometry.points, geometry.mode === 'area', overlayId, tolerance);
    case 'text':
      return Math.abs(point.x - geometry.position.x) <= TEXT_AABB_HALF &&
             Math.abs(point.y - geometry.position.y) <= TEXT_AABB_HALF;
  }
}

function hitPolygon(
  point: Point2D,
  vertices: ReadonlyArray<Point2D>,
  closed: boolean,
  overlayId: string,
  tolerance: number,
): boolean {
  if (vertices.length < 2) return false;
  if (closed && vertices.length >= 3) {
    const universal: UniversalPolygon = {
      id: overlayId,
      type: 'simple',
      points: [...vertices],
      isClosed: true,
      style: { strokeColor: '', fillColor: '', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
    };
    return isPointInPolygon(point, universal);
  }
  return hitPolyline(point, vertices, false, overlayId, tolerance);
}

function hitPolyline(
  point: Point2D,
  points: ReadonlyArray<Point2D>,
  closed: boolean,
  overlayId: string,
  tolerance: number,
): boolean {
  if (points.length < 2) return false;
  if (closed && points.length >= 3) {
    return hitPolygon(point, points, true, overlayId, tolerance);
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(point, points[i], points[i + 1]) <= tolerance) return true;
  }
  return false;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
