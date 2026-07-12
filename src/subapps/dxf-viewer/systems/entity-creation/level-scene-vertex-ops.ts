/**
 * LEVEL-SCENE VERTEX OPS — pure per-entity vertex transforms (SSoT).
 *
 * Extracted from {@link LevelSceneManagerAdapter} (ADR-641 Φ4 — the adapter was at the N.7.1 500-line
 * ceiling; block-member awareness needed room). Behaviour-preserving: these are the exact per-type
 * bodies the adapter's `updateVertex` / `insertVertex` / `removeVertex` / `getVertices` used to inline,
 * now pure functions that take ONE entity and return a NEW entity (or the same reference when the op
 * does not apply). This lets both the top-level map AND the block-member writeback path (ADR-641)
 * reuse the identical vertex logic.
 *
 * Deliberately the CANONICAL-adapter flavour (polyline / line / circle-center / rectangle-corners) —
 * NOT the richer grip-editing semantics of `hooks/grips/grip-scene-manager-adapter.ts` (circle radius
 * via quadrant, arc angles, 4-corner rectangle, angle-measurement), which stays a grip-specialized
 * sibling per ADR-049. No merge across the two (they answer different questions).
 *
 * Pure — no React, no store reads.
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  isLineEntity,
  isCircleEntity,
  isRectangleEntity,
  isPolylineEntity,
  type Entity,
} from '../../types/entities';

/**
 * Return `entity` with vertex `vertexIndex` moved to `position` — polyline vertex, line start/end
 * (0/1), or circle center (0). Any non-matching type/index yields the SAME reference (no-op).
 */
export function applyVertexUpdate(entity: Entity, vertexIndex: number, position: Point2D): Entity {
  if (isPolylineEntity(entity) && 'vertices' in entity) {
    const vertices = [...entity.vertices];
    if (vertexIndex >= 0 && vertexIndex < vertices.length) {
      vertices[vertexIndex] = position;
      return { ...entity, vertices };
    }
  }
  if (isLineEntity(entity)) {
    if (vertexIndex === 0) return { ...entity, start: position } as Entity;
    if (vertexIndex === 1) return { ...entity, end: position } as Entity;
  }
  if (isCircleEntity(entity)) {
    if (vertexIndex === 0) return { ...entity, center: position } as Entity;
  }
  return entity;
}

/**
 * Return `entity` with `position` inserted at `insertIndex` — polylines only. Non-polyline yields the
 * SAME reference.
 */
export function insertEntityVertex(entity: Entity, insertIndex: number, position: Point2D): Entity {
  if (isPolylineEntity(entity) && 'vertices' in entity) {
    const vertices = [...entity.vertices];
    vertices.splice(insertIndex, 0, position);
    return { ...entity, vertices };
  }
  return entity;
}

/**
 * Return `entity` with vertex `vertexIndex` removed — polylines only, and only while more than 2
 * vertices remain. Non-polyline / would-drop-below-2 yields the SAME reference.
 */
export function removeEntityVertex(entity: Entity, vertexIndex: number): Entity {
  if (isPolylineEntity(entity) && 'vertices' in entity) {
    const vertices = [...entity.vertices];
    if (vertexIndex >= 0 && vertexIndex < vertices.length && vertices.length > 2) {
      vertices.splice(vertexIndex, 1);
      return { ...entity, vertices };
    }
  }
  return entity;
}

/**
 * All vertices of `entity` for state inspection — polyline vertices, line [start,end], circle
 * [center], rectangle [corner1,corner2]. `undefined` for types without a vertex list.
 */
export function getEntityVertices(entity: Entity): Point2D[] | undefined {
  if (isPolylineEntity(entity) && 'vertices' in entity) {
    return entity.vertices;
  }
  if (isLineEntity(entity)) {
    const line = entity as { start?: Point2D; end?: Point2D };
    if (line.start && line.end) return [line.start, line.end];
  }
  if (isCircleEntity(entity)) {
    const circle = entity as { center?: Point2D };
    if (circle.center) return [circle.center];
  }
  if (isRectangleEntity(entity) && 'corner1' in entity && 'corner2' in entity) {
    const rect = entity as { corner1?: Point2D; corner2?: Point2D };
    if (rect.corner1 && rect.corner2) return [rect.corner1, rect.corner2];
  }
  return undefined;
}
