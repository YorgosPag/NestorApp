/**
 * SSOT — apply-entity-preview helpers
 *
 * Pure geometry/lookup helpers extracted from `apply-entity-preview.ts`
 * (2026-06-04 file-size split). No state, no side effects.
 *
 * @see rendering/ghost/apply-entity-preview — consumer
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { StairEntity } from '../../bim/types/stair-types';

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

/**
 * Resolve a `DxfStair`-wrapper entity OR raw `StairEntity` to a `StairEntity`.
 * Returns `null` for non-stair entities. Mirror of the dual-shape lookup in
 * `HitTestingService.convertToEntityModel` + `Bounds.calculateStairBounds`.
 */
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
