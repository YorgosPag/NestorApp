/**
 * SSOT — apply-entity-preview
 *
 * Pure function that returns a cloned `DxfEntityUnion` with its geometry
 * transformed for a live drag preview (grip move/stretch, or wholesale
 * translation). Original entity is never mutated.
 *
 * This is the single source of truth for "what does the entity look like
 * during a drag" used by:
 *   - useMovePreview (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview (grip drag, center + vertex + edge)
 *
 * Extracted from `DxfRenderer.applyDragPreview` (ADR-040 Phase D, 2026-05-09)
 * which previously drew the preview inline in the main canvas. The unified
 * preview architecture moves all ghost rendering to the dedicated PreviewCanvas
 * overlay, keeping the bitmap cache invalidation-free during drag.
 *
 * @see rendering/ghost/draw-ghost-entity — companion renderer
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
// ADR-358 Phase 5d — parametric stair drag preview rebuilds full geometry
// from new params; reuse the SSoT helpers so the ghost matches what the
// commit adapter eventually persists.
import { applyStairGripDrag } from '../../bim/stairs/stair-grips';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../bim/types/stair-types';
// ADR-363 Phase 1C — parametric wall drag preview (mirrors stair pattern).
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import type { WallEntity } from '../../bim/types/wall-types';
// ADR-363 Phase 5.5 — parametric beam drag preview.
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import type { BeamEntity } from '../../bim/types/beam-types';
// ADR-397 — parametric column drag preview (mirrors wall: move/rotation/resize).
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import type { ColumnEntity } from '../../bim/types/column-types';
// ADR-363 Phase 3.5 — parametric slab drag preview.
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import type { SlabEntity } from '../../bim/types/slab-types';
// ADR-363 Phase 3.7a — parametric slab-opening drag preview.
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
// ADR-406 — parametric MEP fixture drag preview (move / rotation / corner resize).
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { computeMepFixtureGeometry } from '../../bim/mep-fixtures/mep-fixture-geometry';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
// ADR-408 Φ3 — parametric electrical panel drag preview (move / rotation / corner resize).
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
// ADR-408 Φ8 — parametric MEP segment drag preview (start / end / midpoint / section / rotation).
import { applyMepSegmentGripDrag } from '../../bim/mep-segments/mep-segment-grips';
import { computeMepSegmentGeometry } from '../../bim/geometry/mep-segment-geometry';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
// ADR-410 — parametric furniture drag preview (move / rotation / corner resize).
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import type { EntityPreviewTransform } from './entity-preview-types';
import { getCircleQuadrant, getArcPoint, unwrapStair } from './apply-entity-preview-helpers';

export type { EntityPreviewTransform };

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a drag-preview transform to a DXF entity. Returns a cloned entity
 * with new geometry, or the original entity unchanged when:
 *  - `preview` is undefined / does not target this entity
 *  - `delta` is zero
 *  - the entity type is unsupported for the requested transform
 *
 * Pure: never mutates the input entity.
 */
export function applyEntityPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform | undefined,
): DxfEntityUnion {
  if (!preview || preview.entityId !== entity.id) return entity;
  const { delta, gripIndex, movesEntity, edgeVertexIndices, stairGripKind, wallGripKind, beamGripKind, columnGripKind, slabGripKind, slabOpeningGripKind, mepFixtureGripKind, electricalPanelGripKind, mepSegmentGripKind, furnitureGripKind, anchorPos, rotatePivot } = preview;
  if (delta.x === 0 && delta.y === 0) return entity;

  // ── ADR-363 Phase 1C — parametric wall live preview ───────────────────────
  if (wallGripKind && anchorPos && entity.type === 'wall') {
    const wall = entity as unknown as WallEntity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    // ADR-363 Phase 1G — `rotatePivot` (set only for the wall-rotation 3-click
    // hot-grip) rotates the ghost around the picked centre instead of the midpoint.
    const newParams = applyWallGripDrag(wallGripKind, { originalParams: wall.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === wall.params) return entity;
    const newGeometry = computeWallGeometry(newParams, wall.kind);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-397 — parametric column live preview (move / rotation / resize) ────
  // Mirror of the wall branch: routes through `applyColumnGripDrag` so the live
  // ghost matches the commit. `rotatePivot` (column-rotation 6-click) orbits the
  // picked centre; width/depth/center need no pivot. Without this branch columns
  // had ZERO live preview (commit worked on release only) → "δεν συμπεριφέρεται σωστά".
  if (columnGripKind && anchorPos && entity.type === 'column') {
    const col = entity as unknown as ColumnEntity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const newParams = applyColumnGripDrag(columnGripKind, { originalParams: col.params, delta, currentPos, ...(rotatePivot ? { pivot: rotatePivot } : {}) });
    if (newParams === col.params) return entity;
    const newGeometry = computeColumnGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 5.5 — parametric beam live preview ──────────────────────
  // ADR-363 Phase 5.5d — `rotatePivot` (set only for the beam-rotation 6-click
  // hot-grip) orbits the ghost around the picked centre; `currentPos` lets the
  // pivot-rotate measure the swept angle. Move/start/end/curve/width/depth ignore
  // both (delta-driven). Mirror of the wall/column branch.
  if (beamGripKind && entity.type === 'beam') {
    const beam = entity as unknown as BeamEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyBeamGripDrag(beamGripKind, {
      originalParams: beam.params,
      delta,
      currentPos,
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === beam.params) return entity;
    const newGeometry = computeBeamGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-406 — parametric MEP fixture live preview (move / rotation / corner) ──
  // Mirror of the beam branch; ORTHO (F8) is read from `cadToggleState` so the
  // corner-resize ghost matches the commit. Without this branch the fixture only
  // updated on release (no live feedback).
  if (mepFixtureGripKind && entity.type === 'mep-fixture') {
    const fixture = entity as unknown as MepFixtureEntity;
    // ADR-397 — `rotatePivot` (set only for the mep-fixture-rotation 6-click
    // hot-grip) orbits the ghost around the picked centre; `currentPos` lets the
    // pivot-rotate measure the swept angle. Move/corner ignore both (delta-driven).
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyMepFixtureGripDrag(mepFixtureGripKind, {
      originalParams: fixture.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === fixture.params) return entity;
    const newGeometry = computeMepFixtureGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-408 Φ3 — parametric electrical panel live preview (move/rotation/corner) ──
  // Mirror of the MEP fixture branch; ORTHO (F8) is read from `cadToggleState` so
  // the corner-resize ghost matches the commit. `rotatePivot` (panel-rotation
  // 6-click) orbits the picked centre; move/corner ignore it (delta-driven).
  if (electricalPanelGripKind && entity.type === 'electrical-panel') {
    const panel = entity as unknown as ElectricalPanelEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyElectricalPanelGripDrag(electricalPanelGripKind, {
      originalParams: panel.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === panel.params) return entity;
    const newGeometry = computeElectricalPanelGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-408 Φ8 — parametric MEP segment live preview (start/end/midpoint/section/rotate) ──
  // Mirror of the beam branch: routes through `applyMepSegmentGripDrag` so the live
  // ghost matches the commit. `rotatePivot` (mep-segment-rotation 6-click) orbits the
  // picked centre; start/end/midpoint/section grips are purely delta-driven.
  if (mepSegmentGripKind && entity.type === 'mep-segment') {
    const seg = entity as unknown as MepSegmentEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyMepSegmentGripDrag(mepSegmentGripKind, {
      originalParams: seg.params,
      delta,
      currentPos,
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === seg.params) return entity;
    const newGeometry = computeMepSegmentGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-410 — parametric furniture live preview (move / rotation / corner) ──
  // Mirror of the electrical panel branch; ORTHO (F8) is read from `cadToggleState`
  // so the corner-resize ghost matches the commit. `rotatePivot` (furniture-rotation
  // 6-click) orbits the picked centre; move/corner ignore it (delta-driven).
  if (furnitureGripKind && entity.type === 'furniture') {
    const furniture = entity as unknown as FurnitureEntity;
    const currentPos: Point2D = anchorPos
      ? { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y }
      : { x: delta.x, y: delta.y };
    const newParams = applyFurnitureGripDrag(furnitureGripKind, {
      originalParams: furniture.params,
      delta,
      currentPos,
      ortho: cadToggleState.isOrthoOn(),
      ...(rotatePivot ? { pivot: rotatePivot } : {}),
    });
    if (newParams === furniture.params) return entity;
    const newGeometry = computeFurnitureGeometry(newParams);
    return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 3.5 — parametric slab live preview ──────────────────────
  // entity IS the raw SlabEntity from scene.entities — access .params directly
  // (not via a DxfSlab wrapper; mirrors beam pattern).
  if (slabGripKind && entity.type === 'slab') {
    const slab = entity as unknown as SlabEntity;
    const newParams = applySlabGripDrag(slabGripKind, { originalParams: slab.params, delta });
    if (newParams === slab.params) return entity;
    return { ...(entity as object), params: newParams } as unknown as DxfEntityUnion;
  }

  // ── ADR-363 Phase 3.7a — parametric slab-opening live preview ─────────────
  if (slabOpeningGripKind && entity.type === 'slab-opening') {
    const so = entity as unknown as SlabOpeningEntity;
    const newParams = applySlabOpeningGripDrag(slabOpeningGripKind, { originalParams: so.params, delta });
    if (newParams === so.params) return entity;
    return { ...(entity as object), params: newParams } as unknown as DxfEntityUnion;
  }

  // ── ADR-358 Phase 5d — parametric stair live preview ─────────────────────
  // Stair grips mutate `StairParams`; geometry is fully derived. Route
  // through the same SSoT pure helper the commit adapter uses, then re-derive
  // geometry. We expose the resulting entity in the same `DxfStair` wrapper
  // shape the canvas pipeline uses (`type: 'stair', stairEntity: {...}`),
  // so `drawGhostEntity` can find it via `entity.stairEntity.geometry`.
  if (stairGripKind && anchorPos) {
    const stair = unwrapStair(entity);
    if (!stair) return entity;
    const currentPos: Point2D = { x: anchorPos.x + delta.x, y: anchorPos.y + delta.y };
    const newParams = applyStairGripDrag(stairGripKind, {
      originalParams: stair.params,
      delta,
      currentPos,
      // ADR-393 v2 Phase 2 — multi-flight corner transforms read the last
      // flight's direction from the walkline; supply geometry so the live ghost
      // matches the commit path (otherwise an L/U/Γ end-corner preview would
      // decompose on flight-1's axis and snap on release).
      geometry: stair.geometry,
    });
    if (newParams === stair.params) return entity;
    const newGeometry = computeStairGeometry(newParams);
    const ghostStair: StairEntity = {
      ...stair,
      params: newParams,
      geometry: newGeometry,
    };
    return {
      ...(entity as object),
      type: 'stair',
      stairEntity: ghostStair,
    } as unknown as DxfEntityUnion;
  }

  const offsetPoint = (p: Point2D): Point2D => ({ x: p.x + delta.x, y: p.y + delta.y });

  // ── Whole-entity translation (center grip / Move tool) ──────────────────
  if (movesEntity) {
    switch (entity.type) {
      case 'line':
        return { ...entity, start: offsetPoint(entity.start), end: offsetPoint(entity.end) };
      case 'circle':
        return { ...entity, center: offsetPoint(entity.center) };
      case 'arc':
        return { ...entity, center: offsetPoint(entity.center) };
      case 'polyline':
        return { ...entity, vertices: entity.vertices.map(offsetPoint) };
      case 'text':
        return { ...entity, position: offsetPoint(entity.position) };
      case 'angle-measurement':
        return {
          ...entity,
          vertex: offsetPoint(entity.vertex),
          point1: offsetPoint(entity.point1),
          point2: offsetPoint(entity.point2),
        };
      case 'wall': {
        const wall = entity as unknown as WallEntity;
        // Delegate to SSoT (mirrors beam's applyBeamGripDrag('beam-midpoint', ...) pattern).
        // currentPos unused by moveMidpoint — pass delta as dummy to satisfy the interface.
        const newParams = applyWallGripDrag('wall-midpoint', { originalParams: wall.params, delta, currentPos: delta });
        if (newParams === wall.params) return entity;
        const newGeometry = computeWallGeometry(newParams, wall.kind);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'beam': {
        const beam = entity as unknown as BeamEntity;
        const newParams = applyBeamGripDrag('beam-midpoint', { originalParams: beam.params, delta });
        const newGeometry = computeBeamGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'column': {
        // ADR-397 — toolbar Move-tool ghost (no columnGripKind): translate via
        // the `column-center` SSoT, mirror wall/beam.
        const col = entity as unknown as ColumnEntity;
        const newParams = applyColumnGripDrag('column-center', { originalParams: col.params, delta });
        const newGeometry = computeColumnGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'mep-fixture': {
        // ADR-406 — toolbar Move-tool ghost (no mepFixtureGripKind): translate via
        // the `mep-fixture-move` SSoT, mirror column/wall/beam.
        const fix = entity as unknown as MepFixtureEntity;
        const newParams = applyMepFixtureGripDrag('mep-fixture-move', { originalParams: fix.params, delta });
        const newGeometry = computeMepFixtureGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'electrical-panel': {
        // ADR-408 Φ3 — toolbar Move-tool ghost (no electricalPanelGripKind):
        // translate via the `electrical-panel-move` SSoT, mirror mep-fixture.
        const panel = entity as unknown as ElectricalPanelEntity;
        const newParams = applyElectricalPanelGripDrag('electrical-panel-move', { originalParams: panel.params, delta });
        const newGeometry = computeElectricalPanelGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'furniture': {
        // ADR-410 — toolbar Move-tool ghost (no furnitureGripKind): translate via
        // the `furniture-move` SSoT, mirror mep-fixture/electrical-panel.
        const furn = entity as unknown as FurnitureEntity;
        const newParams = applyFurnitureGripDrag('furniture-move', { originalParams: furn.params, delta });
        const newGeometry = computeFurnitureGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'mep-segment': {
        // ADR-408 Φ8 — toolbar Move-tool ghost (no mepSegmentGripKind):
        // translate via the `mep-segment-midpoint` SSoT (moves both endpoints),
        // mirror beam/electrical-panel.
        const seg = entity as unknown as MepSegmentEntity;
        const newParams = applyMepSegmentGripDrag('mep-segment-midpoint', { originalParams: seg.params, delta });
        const newGeometry = computeMepSegmentGeometry(newParams);
        return { ...(entity as object), params: newParams, geometry: newGeometry } as unknown as DxfEntityUnion;
      }
      case 'slab': {
        const slab = entity as unknown as SlabEntity;
        const vs = slab.params.outline.vertices;
        const movedVerts = vs.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        const newParams = { ...slab.params, outline: { ...slab.params.outline, vertices: movedVerts } };
        return { ...(entity as object), params: newParams } as unknown as DxfEntityUnion;
      }
      case 'slab-opening': {
        const so = entity as unknown as SlabOpeningEntity;
        const vs = so.params.outline.vertices;
        const movedVerts = vs.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        const newParams = { ...so.params, outline: { ...so.params.outline, vertices: movedVerts } };
        return { ...(entity as object), params: newParams } as unknown as DxfEntityUnion;
      }
      case 'opening': {
        const opening = entity as unknown as OpeningEntity;
        const outline = opening.geometry?.outline;
        if (!outline) return entity;
        const movedVerts = outline.vertices.map((v) => ({ ...v, x: v.x + delta.x, y: v.y + delta.y }));
        return {
          ...(entity as object),
          geometry: { ...opening.geometry, outline: { ...outline, vertices: movedVerts } },
        } as unknown as DxfEntityUnion;
      }
    }
  }

  // ── Edge stretch (two vertices move together) ───────────────────────────
  if (edgeVertexIndices) {
    const [v1, v2] = edgeVertexIndices;
    if (entity.type === 'polyline') {
      const vertices = [...entity.vertices];
      if (v1 < vertices.length) vertices[v1] = offsetPoint(vertices[v1]);
      if (v2 < vertices.length) vertices[v2] = offsetPoint(vertices[v2]);
      return { ...entity, vertices };
    }
    if (entity.type === 'line') {
      let result = { ...entity };
      if (v1 === 0 || v2 === 0) result = { ...result, start: offsetPoint(entity.start) };
      if (v1 === 1 || v2 === 1) result = { ...result, end: offsetPoint(entity.end) };
      return result;
    }
  }

  // ── Single-vertex stretch / quadrant / arc end ──────────────────────────
  switch (entity.type) {
    case 'line': {
      if (gripIndex === 0) return { ...entity, start: offsetPoint(entity.start) };
      if (gripIndex === 1) return { ...entity, end: offsetPoint(entity.end) };
      return entity;
    }
    case 'polyline': {
      if (gripIndex < entity.vertices.length) {
        const vertices = [...entity.vertices];
        vertices[gripIndex] = offsetPoint(vertices[gripIndex]);
        return { ...entity, vertices };
      }
      return entity;
    }
    case 'circle': {
      const newQuadrantPos = offsetPoint(getCircleQuadrant(entity, gripIndex));
      return { ...entity, radius: calculateDistance(entity.center, newQuadrantPos) };
    }
    case 'arc': {
      if (gripIndex === 1 || gripIndex === 2) {
        const arcPoint = gripIndex === 1
          ? getArcPoint(entity, entity.startAngle)
          : getArcPoint(entity, entity.endAngle);
        const newPos = offsetPoint(arcPoint);
        const newRadius = calculateDistance(entity.center, newPos);
        let angleDeg = Math.atan2(newPos.y - entity.center.y, newPos.x - entity.center.x) * (180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;
        if (gripIndex === 1) return { ...entity, startAngle: angleDeg, radius: newRadius };
        return { ...entity, endAngle: angleDeg, radius: newRadius };
      }
      return entity;
    }
    case 'angle-measurement': {
      if (gripIndex === 0) return { ...entity, vertex: offsetPoint(entity.vertex) };
      if (gripIndex === 1) return { ...entity, point1: offsetPoint(entity.point1) };
      if (gripIndex === 2) return { ...entity, point2: offsetPoint(entity.point2) };
      return entity;
    }
    default:
      return entity;
  }
}

/**
 * Build a synthetic preview that translates an entire entity by `delta`.
 * Used by the Move tool (toolbar) to express each selected entity as a
 * standard `EntityPreviewTransform` so the same SSOT applies.
 */
export function makeTranslationPreview(entityId: string, delta: Point2D): EntityPreviewTransform {
  return { entityId, gripIndex: -1, delta, movesEntity: true };
}
