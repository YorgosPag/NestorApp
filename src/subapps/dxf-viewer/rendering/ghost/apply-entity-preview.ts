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
import type { StairGripKind } from '../../hooks/grip-types';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { StairEntity } from '../../types/stair';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-entity preview transform. Structurally compatible with `DxfGripDragPreview`
 * (the grip system's projection) so callers can pass the value through without
 * re-mapping.
 *
 * Semantics:
 *  - `movesEntity=true`        → translate every coordinate by `delta`
 *  - `edgeVertexIndices`       → translate exactly two vertices (edge stretch)
 *  - otherwise (`gripIndex`)   → stretch single vertex / quadrant / arc end
 */
export interface EntityPreviewTransform {
  readonly entityId: string;
  readonly gripIndex: number;
  readonly delta: Point2D;
  readonly movesEntity: boolean;
  readonly edgeVertexIndices?: readonly [number, number];
  /**
   * ADR-358 Phase 5d — parametric stair discriminator + anchor. When set,
   * `applyEntityPreview` routes through `applyStairGripDrag` to compute new
   * `StairParams`, recomputes `StairGeometry`, and returns a wrapped stair
   * ghost. Anchor is the grip world position captured at mouseDown.
   */
  readonly stairGripKind?: StairGripKind;
  readonly anchorPos?: Point2D;
}

// ── Helpers (private) ────────────────────────────────────────────────────────

function getCircleQuadrant(
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

function getArcPoint(
  entity: { center: Point2D; radius: number },
  angleDeg: number,
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: entity.center.x + entity.radius * Math.cos(rad),
    y: entity.center.y + entity.radius * Math.sin(rad),
  };
}

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
  const { delta, gripIndex, movesEntity, edgeVertexIndices, stairGripKind, anchorPos } = preview;
  if (delta.x === 0 && delta.y === 0) return entity;

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

/**
 * Resolve a `DxfStair`-wrapper entity OR raw `StairEntity` to a `StairEntity`.
 * Returns `null` for non-stair entities. Mirror of the dual-shape lookup in
 * `HitTestingService.convertToEntityModel` + `Bounds.calculateStairBounds`.
 */
function unwrapStair(entity: DxfEntityUnion): StairEntity | null {
  const e = entity as Partial<StairEntity> & {
    stairEntity?: Partial<StairEntity>;
  };
  if (e.params && e.geometry) return entity as unknown as StairEntity;
  if (e.stairEntity?.params && e.stairEntity?.geometry) {
    return e.stairEntity as StairEntity;
  }
  return null;
}
