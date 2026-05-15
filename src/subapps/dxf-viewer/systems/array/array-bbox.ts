/**
 * ADR-353 SSOT — Source group bounding-box utilities.
 *
 * Computes the union bounding box of all source entities and derives
 * the auto-spacing default (bbox × 1.5) per ADR-353 Q5.
 */

import type { Entity } from '../../types/entities';
import type { SourceBbox } from './types';
import { getEntityBounds } from '../../types/entities';
import { EMPTY_SPATIAL_BOUNDS } from '../../config/geometry-constants';

/**
 * Compute the union bounding box of one or more source entities.
 * Falls back to a 0×0 bbox at origin if the entity list is empty.
 */
export function computeSourceGroupBbox(entities: Entity[]): SourceBbox {
  if (entities.length === 0) {
    return {
      minX: 0, minY: 0, maxX: 0, maxY: 0,
      width: 0, height: 0,
      center: { x: 0, y: 0 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const entity of entities) {
    const b = getEntityBounds(entity);
    if (b === EMPTY_SPATIAL_BOUNDS) continue;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  // All entities had empty bounds (fallback)
  if (minX === Infinity) {
    return {
      minX: 0, minY: 0, maxX: 0, maxY: 0,
      width: 0, height: 0,
      center: { x: 0, y: 0 },
    };
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX, minY, maxX, maxY,
    width, height,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

/**
 * Auto-spacing default per ADR-353 Q5:
 * colSpacing = bboxWidth × 1.5, rowSpacing = bboxHeight × 1.5.
 * Minimum 1 unit to avoid zero-spacing on degenerate bboxes.
 */
export function defaultRectSpacing(bbox: SourceBbox): {
  colSpacing: number;
  rowSpacing: number;
} {
  return {
    colSpacing: Math.max(1, bbox.width * 1.5),
    rowSpacing: Math.max(1, bbox.height * 1.5),
  };
}
