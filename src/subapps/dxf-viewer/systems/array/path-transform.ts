/**
 * ADR-353 C2 — Path array transform computation.
 * Converts PathParams + pathEntity into per-item ItemTransform[].
 *
 * method='divide': equal spacing by count. Open: u_i = i/(N-1). Closed: u_i = i/N.
 * method='measure': fixed arc distance. Stops before endpoint (AutoCAD pattern).
 */

import type { PathParams, ItemTransform, SourceBbox } from './types';
import type { Entity } from '../../types/entities';
import { pathTotalLength, samplePath } from './path-arc-length-sampler';

const TWO_PI = Math.PI * 2;

function isClosedPathEntity(entity: Entity): boolean {
  if (entity.type === 'circle') return true;
  if (entity.type === 'ellipse') {
    const e = entity as { startParam?: number; endParam?: number };
    return ((e.endParam ?? TWO_PI) - (e.startParam ?? 0)) >= TWO_PI - 1e-6;
  }
  const maybeCloseable = entity as { closed?: boolean };
  return maybeCloseable.closed === true;
}

function buildUValues(params: PathParams, pathEntity: Entity): number[] {
  if (params.method === 'divide') {
    const { count } = params;
    if (count <= 0) return [];
    if (count === 1) return [0];
    const divisor = isClosedPathEntity(pathEntity) ? count : count - 1;
    return Array.from({ length: count }, (_, i) => i / divisor);
  }

  const spacing = params.spacing ?? 0;
  if (spacing <= 0) return [];
  const total = pathTotalLength(pathEntity);
  if (total <= 0) return [];

  const us: number[] = [];
  let dist = 0;
  while (dist < total) {
    us.push(dist / total);
    dist += spacing;
  }
  return us;
}

/**
 * Compute per-item transforms for a path array.
 * Returns empty array if pathEntity is unsupported or count=0.
 */
export function computePathTransforms(
  params: PathParams,
  sourceBbox: SourceBbox,
  pathEntity: Entity,
): ItemTransform[] {
  const total = pathTotalLength(pathEntity);
  if (total <= 0 || params.count <= 0) return [];

  const us = buildUValues(params, pathEntity);
  const cx = sourceBbox.center.x;
  const cy = sourceBbox.center.y;

  const result: ItemTransform[] = [];
  for (const u of us) {
    const s = samplePath(pathEntity, u, params.reversed);
    if (!s) continue;
    result.push({
      translateX: s.position.x - cx,
      translateY: s.position.y - cy,
      rotateDeg: params.alignItems ? s.tangentDeg : 0,
    });
  }
  return result;
}
