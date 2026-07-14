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
import { createPrng, symmetricJitter, mixSeed } from '../../utils/seeded-prng';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

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
 *
 * Beyond plain tangent-follow, this applies the ADR-353 M1 "magical" extras when present:
 *   - `alignOffsetDeg` — constant angle added on top of the tangent (AutoCAD "Base angle").
 *   - seeded scatter — per-item ± rotation / uniform-scale / lateral (path-normal) offset, all
 *     driven by a deterministic PRNG so the layout is stable across reload + undo.
 * The `translate` places the source bbox center at the sample point; scatter offset nudges it along
 * the path normal; `scale` rides on the ItemTransform and is applied downstream by the scaleEntity SSoT.
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
  const seed = params.seed ?? 0;

  const result: ItemTransform[] = [];
  us.forEach((u, i) => {
    const s = samplePath(pathEntity, u, params.reversed);
    if (!s) return;
    result.push(buildItemTransform(params, s, i, seed, cx, cy));
  });
  return result;
}

/** Per-item transform: tangent + align-offset + seeded rotation/scale/normal-offset jitter. */
function buildItemTransform(
  params: PathParams,
  sample: { position: { x: number; y: number }; tangentDeg: number },
  index: number,
  seed: number,
  cx: number,
  cy: number,
): ItemTransform {
  const rng = createPrng(mixSeed(seed, index));
  const baseAngle = params.alignItems ? sample.tangentDeg + (params.alignOffsetDeg ?? 0) : 0;
  const rotateDeg = baseAngle + symmetricJitter(rng, params.rotationJitterDeg ?? 0);

  // Lateral scatter runs along the path NORMAL (tangent + 90°) so items spread across the path,
  // not along it (which would just re-space them). Zero amplitude → exact on-path placement.
  const offset = symmetricJitter(rng, params.offsetJitter ?? 0);
  const normalRad = (sample.tangentDeg + 90) * DEG_TO_RAD;
  const dx = offset * Math.cos(normalRad);
  const dy = offset * Math.sin(normalRad);

  const scale = 1 + symmetricJitter(rng, (params.scaleJitterPct ?? 0) / 100);

  return {
    translateX: sample.position.x + dx - cx,
    translateY: sample.position.y + dy - cy,
    rotateDeg,
    scale,
  };
}
