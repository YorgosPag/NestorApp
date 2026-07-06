/**
 * SSOT — apply-entity-preview helpers
 *
 * Pure geometry/lookup helpers extracted from `apply-entity-preview.ts`.
 * No state, no side effects.
 *
 * @see rendering/ghost/apply-entity-preview — consumer
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { StairEntity } from '../../bim/types/stair-types';
import type { SceneEntity } from '../../core/commands/interfaces';
import { calculateDistance, translatePoint } from '../entities/shared/geometry-rendering-utils';
// SSoT — canonical rigid-move geometry: routes BIM/hatch via `calculateBimMovedGeometry`
// (openings stay host-derived) + DXF primitives incl. `lwpolyline` natively. The classic
// whole-entity ghost delegates here so preview ≡ commit BY IDENTITY (zero duplicate logic).
import { calculateMovedGeometry } from '../../core/commands/entity-commands/move-entity-geometry';

export function getCircleQuadrant(
  entity: { center: Point2D; radius: number },
  gripIndex: number,
): Point2D {
  const { center, radius } = entity;
  switch (gripIndex) {
    case 1: return { x: center.x + radius, y: center.y };
    case 2: return { x: center.x, y: center.y + radius };
    case 3: return { x: center.x - radius, y: center.y };
    case 4: return { x: center.x, y: center.y - radius };
    default: return center;
  }
}

export function getArcPoint(
  entity: { center: Point2D; radius: number },
  angleDeg: number,
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: entity.center.x + entity.radius * Math.cos(rad),
    y: entity.center.y + entity.radius * Math.sin(rad),
  };
}

/** Resolve a `DxfStair`-wrapper entity OR raw `StairEntity` to a `StairEntity`. */
export function unwrapStair(entity: DxfEntityUnion): StairEntity | null {
  const e = entity as Partial<StairEntity> & {
    stairEntity?: Partial<StairEntity>;
  };
  if (e.params && e.geometry) return entity as unknown as StairEntity;
  if (e.stairEntity?.params && e.stairEntity?.geometry) {
    return e.stairEntity as StairEntity;
  }
  return null;
}

// ── Classic entity preview (whole-translation + vertex stretch) ───────────────
// Extracted from apply-entity-preview.ts to keep that file under 500 lines.

/**
 * SSoT for whole-entity translation, edge-stretch, and single-vertex-stretch
 * preview paths (the "classic" non-parametric grip branches).
 * Called from `applyEntityPreview` after all parametric branches have been tried.
 */
export function applyClassicEntityPreview(
  entity: DxfEntityUnion,
  delta: Point2D,
  gripIndex: number,
  movesEntity: boolean | undefined,
  edgeVertexIndices: readonly [number, number] | undefined,
): DxfEntityUnion {
  const off = (p: Point2D) => translatePoint(p, delta);

  if (movesEntity) {
    // SSoT convergence (ADR-561) — whole-entity translate delegates to the canonical
    // rigid-move geometry `calculateMovedGeometry`, which routes BIM/hatch through
    // `calculateBimMovedGeometry` (openings stay host-derived → no-op, matching the commit)
    // and DXF primitives incl. `lwpolyline` + angle-measurement natively. This replaced a
    // divergent inline per-type BIM switch (`applyXGripDrag` re-derivations) that could — and
    // for `opening` DID — drift from the commit. Now preview ≡ commit BY IDENTITY.
    const patch = calculateMovedGeometry(entity as unknown as SceneEntity, { x: delta.x, y: delta.y, z: 0 });
    return Object.keys(patch).length > 0
      ? ({ ...(entity as object), ...patch } as unknown as DxfEntityUnion)
      : entity;
  }

  if (edgeVertexIndices) {
    const [v1, v2] = edgeVertexIndices;
    if (entity.type === 'polyline') {
      const vertices = [...entity.vertices];
      if (v1 < vertices.length) vertices[v1] = off(vertices[v1]);
      if (v2 < vertices.length) vertices[v2] = off(vertices[v2]);
      return { ...entity, vertices };
    }
    if (entity.type === 'line') {
      let result = { ...entity };
      if (v1 === 0 || v2 === 0) result = { ...result, start: off(entity.start) };
      if (v1 === 1 || v2 === 1) result = { ...result, end: off(entity.end) };
      return result;
    }
  }

  switch (entity.type) {
    case 'line': {
      if (gripIndex === 0) return { ...entity, start: off(entity.start) };
      if (gripIndex === 1) return { ...entity, end: off(entity.end) };
      return entity;
    }
    case 'polyline': {
      if (gripIndex < entity.vertices.length) {
        const vertices = [...entity.vertices];
        vertices[gripIndex] = off(vertices[gripIndex]);
        return { ...entity, vertices };
      }
      return entity;
    }
    case 'circle': {
      const newQuadrantPos = off(getCircleQuadrant(entity, gripIndex));
      return { ...entity, radius: calculateDistance(entity.center, newQuadrantPos) };
    }
    case 'arc': {
      if (gripIndex === 1 || gripIndex === 2) {
        const arcPoint = gripIndex === 1
          ? getArcPoint(entity, entity.startAngle)
          : getArcPoint(entity, entity.endAngle);
        const newPos = off(arcPoint);
        const newRadius = calculateDistance(entity.center, newPos);
        let angleDeg = Math.atan2(newPos.y - entity.center.y, newPos.x - entity.center.x) * (180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;
        if (gripIndex === 1) return { ...entity, startAngle: angleDeg, radius: newRadius };
        return { ...entity, endAngle: angleDeg, radius: newRadius };
      }
      return entity;
    }
    case 'angle-measurement': {
      if (gripIndex === 0) return { ...entity, vertex: off(entity.vertex) };
      if (gripIndex === 1) return { ...entity, point1: off(entity.point1) };
      if (gripIndex === 2) return { ...entity, point2: off(entity.point2) };
      return entity;
    }
    default:
      return entity;
  }
}
