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
// ADR-049 Phase 2 — move delta is 3D (optional `z` = elevation delta in mm).
import type { Point3D } from '../../../bim/types/bim-base';
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
// ADR-363 Phase 7A — BIM move geometry (params + computed geometry atomic patch).
import { calculateBimMovedGeometry } from '../../../bim/utils/bim-move-geometry';

/**
 * Apply delta movement to a point
 */
export function applyDelta(point: Point2D, delta: Point2D): Point2D {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

/**
 * Calculate geometry updates for an entity based on delta.
 * Uses centralized type guards from types/entities.ts (ADR-102).
 */
export function calculateMovedGeometry(entity: SceneEntity, delta: Point3D): Partial<SceneEntity> {
  const e = entity as unknown as Entity;

  // ADR-363 Phase 7A — BIM types first. Returns full `{params, geometry}`
  // atomic patch (mirrors `UpdateWallParamsCommand.applyPatch` pattern) so
  // renderer reads stay consistent with the parametric SSoT after move.
  const bimPatch = calculateBimMovedGeometry(e, delta);
  if (bimPatch !== null) {
    return bimPatch;
  }

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

  // ADR-575 — GROUP container: moving the group moves every member. Recurse the
  // SAME geometry SSoT per member (handles nested groups too), so the container
  // never needs to know each primitive's geometry shape.
  if (e.type === 'group' && 'members' in e && Array.isArray((e as { members: unknown }).members)) {
    const members = (e as unknown as { members: Entity[] }).members.map((m) => ({
      ...m,
      ...calculateMovedGeometry(m as unknown as SceneEntity, delta),
    }));
    return { members } as unknown as Partial<SceneEntity>;
  }

  return {};
}
