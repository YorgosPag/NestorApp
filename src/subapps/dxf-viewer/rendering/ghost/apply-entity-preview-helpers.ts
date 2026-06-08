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
import type { WallEntity } from '../../bim/types/wall-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import { applyMepManifoldGripDrag } from '../../bim/mep-manifolds/mep-manifold-grips';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';
import { applyMepSegmentGripDrag } from '../../bim/mep-segments/mep-segment-grips';
import { computeMepSegmentGeometry } from '../../bim/geometry/mep-segment-geometry';
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';

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

function offsetPoint(p: Point2D, delta: Point2D): Point2D {
  return { x: p.x + delta.x, y: p.y + delta.y };
}

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
  const off = (p: Point2D) => offsetPoint(p, delta);

  if (movesEntity) {
    switch (entity.type) {
      case 'line':
        return { ...entity, start: off(entity.start), end: off(entity.end) };
      case 'circle':
        return { ...entity, center: off(entity.center) };
      case 'arc':
        return { ...entity, center: off(entity.center) };
      case 'polyline':
        return { ...entity, vertices: entity.vertices.map(off) };
      case 'text':
        return { ...entity, position: off(entity.position) };
      case 'angle-measurement':
        return { ...entity, vertex: off(entity.vertex), point1: off(entity.point1), point2: off(entity.point2) };
      case 'wall': {
        const wall = entity as unknown as WallEntity;
        const newParams = applyWallGripDrag('wall-midpoint', { originalParams: wall.params, delta, currentPos: delta });
        if (newParams === wall.params) return entity;
        return { ...(entity as object), params: newParams, geometry: computeWallGeometry(newParams, wall.kind) } as unknown as DxfEntityUnion;
      }
      case 'beam': {
        const beam = entity as unknown as BeamEntity;
        const newParams = applyBeamGripDrag('beam-midpoint', { originalParams: beam.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeBeamGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'column': {
        const col = entity as unknown as ColumnEntity;
        const newParams = applyColumnGripDrag('column-center', { originalParams: col.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeColumnGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'mep-fixture': {
        const fix = entity as unknown as MepFixtureEntity;
        const newParams = applyMepFixtureGripDrag('mep-fixture-move', { originalParams: fix.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeMepFixtureGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'electrical-panel': {
        const panel = entity as unknown as ElectricalPanelEntity;
        const newParams = applyElectricalPanelGripDrag('electrical-panel-move', { originalParams: panel.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeElectricalPanelGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'mep-manifold': {
        const manifold = entity as unknown as MepManifoldEntity;
        const newParams = applyMepManifoldGripDrag('mep-manifold-move', { originalParams: manifold.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeMepManifoldGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'furniture': {
        const furn = entity as unknown as FurnitureEntity;
        const newParams = applyFurnitureGripDrag('furniture-move', { originalParams: furn.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeFurnitureGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'mep-segment': {
        const seg = entity as unknown as MepSegmentEntity;
        const newParams = applyMepSegmentGripDrag('mep-segment-midpoint', { originalParams: seg.params, delta });
        return { ...(entity as object), params: newParams, geometry: computeMepSegmentGeometry(newParams) } as unknown as DxfEntityUnion;
      }
      case 'slab': {
        const slab = entity as unknown as SlabEntity;
        const movedVerts = slab.params.outline.vertices.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        return { ...(entity as object), params: { ...slab.params, outline: { ...slab.params.outline, vertices: movedVerts } } } as unknown as DxfEntityUnion;
      }
      case 'floor-finish': {
        const finish = entity as unknown as FloorFinishEntity;
        const movedVerts = finish.params.footprint.vertices.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        return { ...(entity as object), params: { ...finish.params, footprint: { ...finish.params.footprint, vertices: movedVerts } } } as unknown as DxfEntityUnion;
      }
      case 'slab-opening': {
        const so = entity as unknown as SlabOpeningEntity;
        const movedVerts = so.params.outline.vertices.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        return { ...(entity as object), params: { ...so.params, outline: { ...so.params.outline, vertices: movedVerts } } } as unknown as DxfEntityUnion;
      }
      case 'opening': {
        const opening = entity as unknown as OpeningEntity;
        const outline = opening.geometry?.outline;
        if (!outline) return entity;
        return { ...(entity as object), geometry: { ...opening.geometry, outline: { ...outline, vertices: outline.vertices.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y })) } } } as unknown as DxfEntityUnion;
      }
    }
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
