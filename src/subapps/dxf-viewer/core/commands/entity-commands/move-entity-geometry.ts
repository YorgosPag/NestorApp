/**
 * Move Entity Geometry Utilities
 *
 * Type-safe geometry calculations for entity movement operations.
 * Extracted from MoveEntityCommand.ts per ADR-065 (file size compliance).
 *
 * @module core/commands/entity-commands/move-entity-geometry
 */

import type { SceneEntity } from '../interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import {
  isLineEntity,
  isCircleEntity,
  isRectangleEntity,
  isArcEntity,
  isEllipseEntity,
  isPolylineEntity,
  isTextEntity,
  isPointEntity,
  type Entity,
} from '../../../types/entities';

/**
 * Apply delta movement to a point
 */
export function applyDelta(point: Point2D, delta: Point2D): Point2D {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

/**
 * Calculate reverse delta
 */
export function reverseDelta(delta: Point2D): Point2D {
  return { x: -delta.x, y: -delta.y };
}

/**
 * Calculate geometry updates for an entity based on delta.
 * Uses centralized type guards from types/entities.ts (ADR-102).
 */
export function calculateMovedGeometry(entity: SceneEntity, delta: Point2D): Partial<SceneEntity> {
  const e = entity as unknown as Entity;

  if (isLineEntity(e)) {
    return {
      start: applyDelta(e.start, delta),
      end: applyDelta(e.end, delta),
    };
  }

  if (isCircleEntity(e)) {
    return { center: applyDelta(e.center, delta) };
  }

  if (isRectangleEntity(e)) {
    const updates: Partial<SceneEntity> = {};
    if ('corner1' in e && e.corner1 && 'corner2' in e && e.corner2) {
      updates.corner1 = applyDelta(e.corner1, delta);
      updates.corner2 = applyDelta(e.corner2, delta);
    }
    if ('x' in e && 'y' in e) {
      updates.x = e.x + delta.x;
      updates.y = e.y + delta.y;
    }
    return updates;
  }

  if (isArcEntity(e)) {
    return { center: applyDelta(e.center, delta) };
  }

  if (isEllipseEntity(e)) {
    return { center: applyDelta(e.center, delta) };
  }

  if (isPolylineEntity(e)) {
    return { vertices: e.vertices.map(v => applyDelta(v, delta)) };
  }

  // Handle polygon type (not in centralized guards but used in codebase)
  if (entity.type === 'polygon' && 'vertices' in entity) {
    const polyEntity = entity as unknown as { vertices: Point2D[] };
    return { vertices: polyEntity.vertices.map(v => applyDelta(v, delta)) };
  }

  if (isTextEntity(e)) {
    return { position: applyDelta(e.position, delta) };
  }

  if (isPointEntity(e)) {
    return { position: applyDelta(e.position, delta) };
  }

  return {};
}
