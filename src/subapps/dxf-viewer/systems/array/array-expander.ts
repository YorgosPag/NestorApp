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
import type { RectParams } from './types';
import { computeRectTransforms } from './rect-transform';
import { computeSourceGroupBbox } from './array-bbox';
import { applyTransformToEntity } from './array-entity-transform';

/**
 * Expand a rectangular ArrayEntity into rendered/snap-candidate items.
 *
 * Returns an empty array for unsupported array kinds (polar/path — Phase B+).
 * Each returned item carries the parent ArrayEntity's `id` so that click
 * hit-testing resolves to the correct scene entity.
 */
export function expandArrayEntity(entity: ArrayEntity): Entity[] {
  if (entity.arrayKind !== 'rect') return [];

  const params = entity.params as RectParams;
  const bbox = computeSourceGroupBbox(entity.hiddenSources);
  const transforms = computeRectTransforms(params, bbox);

  const result: Entity[] = [];

  for (const transform of transforms) {
    for (const source of entity.hiddenSources) {
      const item = applyTransformToEntity(source, transform, bbox.center);
      result.push({ ...item, id: entity.id });
    }
  }

  return result;
}
