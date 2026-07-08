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
  isLWPolylineEntity,
  isTextEntity,
  isMTextEntity,
  isPointEntity,
  isBlockEntity,
  isHatchEntity,
  type Entity,
} from '../../../types/entities';
// ADR-363 Phase 7A — BIM move geometry (params + computed geometry atomic patch).
import { calculateBimMovedGeometry } from '../../../bim/utils/bim-move-geometry';
// SSoT — canonical point translation (ADR-577 consolidation).
import { translatePoint } from '../../../rendering/entities/shared/geometry-vector-utils';

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
      start: translatePoint(e.start, delta),
      end: translatePoint(e.end, delta),
    };
  }

  if (isCircleEntity(e)) {
    return { center: translatePoint(e.center, delta) };
  }

  if (isRectangleEntity(e) || entity.type === 'rect') {
    const updates: Partial<SceneEntity> = {};
    if ('corner1' in e && e.corner1 && 'corner2' in e && e.corner2) {
      updates.corner1 = translatePoint(e.corner1, delta);
      updates.corner2 = translatePoint(e.corner2, delta);
    }
    if ('x' in e && 'y' in e) {
      updates.x = e.x + delta.x;
      updates.y = e.y + delta.y;
    }
    return updates;
  }

  if (isArcEntity(e)) {
    return { center: translatePoint(e.center, delta) };
  }

  if (isEllipseEntity(e)) {
    return { center: translatePoint(e.center, delta) };
  }

  // ADR-186/561 — a JOIN produces a scene `'lwpolyline'` (same `vertices` shape as a
  // polyline). Handle it natively (keep-type) so the whole move/directional/body-drag/copy
  // spine translates joined entities — the commit-side counterpart of `normalizePreviewEntity`.
  if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
    return { vertices: e.vertices.map(v => translatePoint(v, delta)) };
  }

  // Handle polygon type (not in centralized guards but used in codebase)
  if (entity.type === 'polygon' && 'vertices' in entity) {
    const polyEntity = entity as unknown as { vertices: Point2D[] };
    return { vertices: polyEntity.vertices.map(v => translatePoint(v, delta)) };
  }

  // ADR-507 — HATCH: geometry lives in `boundaryPaths` (outer + islands) + optional
  // `seedPoints` (island-detection anchors). Translate every point so a whole-entity move
  // (body-drag / directional / Alt move-from-point / COPY) — and a GROUP move that recurses
  // this SSoT per member — carries the fill with its frame. Without this a hatch inside a
  // moved group stayed put while its boundary lines moved (Giorgio 2026-07-07).
  if (isHatchEntity(e)) {
    const patch: { boundaryPaths: Point2D[][]; seedPoints?: Point2D[] } = {
      boundaryPaths: e.boundaryPaths.map(path => path.map(p => translatePoint(p, delta))),
    };
    if (e.seedPoints) patch.seedPoints = e.seedPoints.map(p => translatePoint(p, delta));
    return patch as Partial<SceneEntity>;
  }

  // Angle-measurement primitive (not a centralized guard) — translate its 3 defining points.
  if (entity.type === 'angle-measurement' && 'vertex' in entity) {
    const a = entity as unknown as { vertex: Point2D; point1: Point2D; point2: Point2D };
    return {
      vertex: translatePoint(a.vertex, delta),
      point1: translatePoint(a.point1, delta),
      point2: translatePoint(a.point2, delta),
    } as unknown as Partial<SceneEntity>;
  }

  if (isTextEntity(e)) {
    return { position: translatePoint(e.position, delta) };
  }

  if (isPointEntity(e)) {
    return { position: translatePoint(e.position, delta) };
  }

  // MTEXT + INSERT/BLOCK — rigid position translate. Canonical rigid-move now covers the
  // full type set previously duplicated in `translateEntityByAnchor` (SSoT convergence).
  if (isMTextEntity(e) || isBlockEntity(e)) {
    return { position: translatePoint(e.position, delta) };
  }

  // ADR-583 — annotation symbol (North arrow): lightweight position-anchored decoration.
  // Rigid translate of the insertion point (mirror text/point/block). Without this the
  // 4-arrow MOVE grip + the MOVE tool were silent no-ops on a north arrow.
  if (entity.type === 'annotation-symbol' && 'position' in e) {
    return { position: translatePoint((e as unknown as { position: Point2D }).position, delta) };
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
