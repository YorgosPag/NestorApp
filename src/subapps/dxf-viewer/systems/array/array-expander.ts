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
import type { Point2D } from '../../rendering/types/Types';
import type { RectParams, PolarParams, PathParams, ItemTransform } from './types';
import { computeRectTransforms } from './rect-transform';
import { computePolarTransforms } from './polar-transform';
import { computePathTransforms } from './path-transform';
import { computeSourceGroupBbox } from './array-bbox';
import { applyTransformToEntity } from './array-entity-transform';
import { createPrng, mixSeed } from '../../utils/seeded-prng';

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
  const distribution = resolveDistribution(entity);

  return distribution === 'group'
    ? expandGrouped(entity, transforms, bbox.center)
    : expandPerPoint(entity, transforms, bbox.center, distribution);
}

/**
 * Distribution mode SSoT — only PATH arrays with an explicit `sourceDistribution` of
 * 'sequential'/'random' place one source per point; everything else (rect/polar, or the default)
 * replicates the whole source group at each cell (legacy behavior, zero regression).
 */
function resolveDistribution(entity: ArrayEntity): 'group' | 'sequential' | 'random' {
  if (entity.arrayKind !== 'path') return 'group';
  return (entity.params as PathParams).sourceDistribution ?? 'group';
}

/** Legacy semantics: the whole source group is stamped at every transform (cell / sample point). */
function expandGrouped(entity: ArrayEntity, transforms: ItemTransform[], groupCenter: Point2D): Entity[] {
  const result: Entity[] = [];
  for (const transform of transforms) {
    for (const source of entity.hiddenSources) {
      const item = applyTransformToEntity(source, transform, groupCenter);
      result.push({ ...item, id: entity.id });
    }
  }
  return result;
}

/**
 * Variety semantics (C4D Cloner parity): ONE source per sample point, cycled in order ('sequential')
 * or seeded-random ('random'). The picked source's OWN center is placed at the sample point — so a
 * tree/car whose center differs from the group center still lands exactly on the path — by re-basing
 * the transform from the group center onto the picked source's center.
 */
function expandPerPoint(
  entity: ArrayEntity,
  transforms: ItemTransform[],
  groupCenter: Point2D,
  distribution: 'sequential' | 'random',
): Entity[] {
  const sources = entity.hiddenSources;
  const centers = sources.map(s => computeSourceGroupBbox([s]).center);
  const seed = (entity.params as PathParams).seed ?? 0;

  const result: Entity[] = [];
  transforms.forEach((transform, i) => {
    const pick = distribution === 'random'
      ? Math.floor(createPrng(mixSeed(seed ^ 0x5f356495, i))() * sources.length)
      : i % sources.length;
    const source = sources[pick];
    const center = centers[pick];
    // Re-base: the transform's translate targets the GROUP center; shift it so the PICKED source's
    // center lands on the same sample point, and rotate/scale about that source's own center.
    const rebased: ItemTransform = {
      ...transform,
      translateX: transform.translateX + (groupCenter.x - center.x),
      translateY: transform.translateY + (groupCenter.y - center.y),
    };
    const item = applyTransformToEntity(source, rebased, center);
    result.push({ ...item, id: entity.id });
  });
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
