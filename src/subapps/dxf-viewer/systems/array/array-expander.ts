/**
 * ADR-353 SSOT — Array entity expansion.
 *
 * Expands an ArrayEntity into its constituent rendered items (one per cell × source).
 * Pure function — no side effects, no React, no canvas.
 *
 * Used by:
 *   - useDxfSceneConversion  → render array items in canvas
 *   - useGlobalSnapSceneSync → snap candidates for array items
 *
 * Item IDs are set to the parent ArrayEntity ID so that hit-testing and
 * selection resolve to the ArrayEntity on click (ADR-353 §Selection).
 */

import type { ArrayEntity, Entity } from '../../types/entities';
import type { RectParams, PolarParams, PathParams, ItemTransform } from './types';
import { computeRectTransforms } from './rect-transform';
import { computePolarTransforms } from './polar-transform';
import { computePathTransforms } from './path-transform';
import { computeSourceGroupBbox } from './array-bbox';
import { applyTransformToEntity } from './array-entity-transform';

/**
 * Expand an ArrayEntity into rendered/snap-candidate items.
 *
 * Dispatches to the correct transform math by arrayKind.
 * Path kind requires pathEntity (looked up by caller from the scene).
 * Each returned item carries the parent ArrayEntity's `id` so that click
 * hit-testing resolves to the correct scene entity.
 */
export function expandArrayEntity(entity: ArrayEntity, pathEntity?: Entity): Entity[] {
  if (entity.hiddenSources.length === 0) return [];

  const bbox = computeSourceGroupBbox(entity.hiddenSources);
  const transforms = computeTransformsForKind(entity, bbox, pathEntity);

  const result: Entity[] = [];
  for (const transform of transforms) {
    for (const source of entity.hiddenSources) {
      const item = applyTransformToEntity(source, transform, bbox.center);
      result.push({ ...item, id: entity.id });
    }
  }
  return result;
}

function computeTransformsForKind(
  entity: ArrayEntity,
  bbox: ReturnType<typeof computeSourceGroupBbox>,
  pathEntity?: Entity,
): ItemTransform[] {
  switch (entity.arrayKind) {
    case 'rect':
      return computeRectTransforms(entity.params as RectParams, bbox);
    case 'polar':
      return computePolarTransforms(entity.params as PolarParams, bbox);
    case 'path':
      if (!pathEntity) return [];
      return computePathTransforms(entity.params as PathParams, bbox, pathEntity);
    default:
      return [];
  }
}
