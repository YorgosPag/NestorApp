/**
 * ENTITY DISTANCE — Point-to-curve distance per entity type.
 *
 * Centralised reuse of the per-entity proximity math scattered across
 * useCanvasClickHandler's `testEntityHit` and the snap engine. Returns the
 * point-to-edge distance for any curve entity, `null` for unsupported types.
 *
 * Used by the TRIM tool's nearest-on-entity pick (ADR-350 Q18).
 */

import type { Point2D } from '../rendering/types/Types';
import { pointToLineDistance } from '../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from './angle-entity-math';
import {
  isArcEntity,
  isCircleEntity,
  isEllipseEntity,
  isLineEntity,
  isLWPolylineEntity,
  isPolylineEntity,
  isRayEntity,
  isSplineEntity,
  isXLineEntity,
  type Entity,
} from '../types/entities';

const NOMINAL_INFINITE = 1e6;

/**
 * Returns the closest distance from `point` to the visible silhouette of
 * `entity`. `null` when the entity type is not a curve.
 *
 * `_tolerance` is reserved for future early-out optimisations; current
 * implementations compute the exact distance.
 */
export function distanceToEntity(point: Point2D, entity: Entity, _tolerance: number): number | null {
  if (isLineEntity(entity)) return pointToLineDistance(point, entity.start, entity.end);
  if (isArcEntity(entity)) return pointToArcDistance(point, entity);
  if (isCircleEntity(entity)) {
    const dx = point.x - entity.center.x;
    const dy = point.y - entity.center.y;
    return Math.abs(Math.hypot(dx, dy) - entity.radius);
  }
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return distanceToPolyline(point, entity.vertices, entity.closed === true);
  }
  if (isEllipseEntity(entity)) {
    const dx = point.x - entity.center.x;
    const dy = point.y - entity.center.y;
    const rx = entity.majorAxis || 1;
    const ry = entity.minorAxis || 1;
    return Math.abs(Math.hypot(dx / rx, dy / ry) - 1) * Math.min(rx, ry);
  }
  if (isSplineEntity(entity)) {
    return distanceToPolyline(point, entity.controlPoints, entity.closed === true);
  }
  if (isRayEntity(entity)) {
    const end: Point2D = {
      x: entity.basePoint.x + entity.direction.x * NOMINAL_INFINITE,
      y: entity.basePoint.y + entity.direction.y * NOMINAL_INFINITE,
    };
    return pointToLineDistance(point, entity.basePoint, end);
  }
  if (isXLineEntity(entity)) {
    const a: Point2D = {
      x: entity.basePoint.x - entity.direction.x * NOMINAL_INFINITE,
      y: entity.basePoint.y - entity.direction.y * NOMINAL_INFINITE,
    };
    const b: Point2D = {
      x: entity.basePoint.x + entity.direction.x * NOMINAL_INFINITE,
      y: entity.basePoint.y + entity.direction.y * NOMINAL_INFINITE,
    };
    return pointToLineDistance(point, a, b);
  }
  return null;
}

function distanceToPolyline(
  point: Point2D,
  vertices: ReadonlyArray<Point2D> | undefined,
  closed: boolean,
): number | null {
  if (!vertices || vertices.length < 2) return null;
  let best = Infinity;
  for (let i = 1; i < vertices.length; i++) {
    const d = pointToLineDistance(point, vertices[i - 1], vertices[i]);
    if (d < best) best = d;
  }
  if (closed && vertices.length > 2) {
    const d = pointToLineDistance(point, vertices[vertices.length - 1], vertices[0]);
    if (d < best) best = d;
  }
  return best === Infinity ? null : best;
}
