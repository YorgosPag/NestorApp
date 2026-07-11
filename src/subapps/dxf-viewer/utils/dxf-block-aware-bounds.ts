/**
 * ADR-640 Φ7 — block-aware scene bounds.
 *
 * A BlockEntity container contributes NOTHING to {@link DxfSceneBuilder.calculateBounds}
 * (which only knows the primitive line/polyline/circle/arc cases), so before the bounds
 * pass we expand any blocks to their world-space members via the render expander SSoT
 * ({@link expandBlockInstance}). Without this, auto-fit / zoom-extents collapse to a point
 * whenever the drawing is a single INSERT.
 *
 * `calculateBounds` is INJECTED (not imported) purely to avoid an import cycle with
 * `dxf-scene-builder.ts`, whose static method owns the primitive-bounds math (SSoT).
 */

import { isBlockEntity } from '../types/entities';
import { expandBlockInstance } from '../systems/block/block-expander';
import type { AnySceneEntity } from '../types/scene';

export interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

/** Empty-scene fallback box (mirrors the builder's historical default extents). */
const FALLBACK_BOUNDS: SceneBounds = { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } };

export function calculateBoundsWithBlocks(
  list: AnySceneEntity[],
  calculateBounds: (entities: AnySceneEntity[]) => SceneBounds,
): SceneBounds {
  const flat = list.some(isBlockEntity)
    ? (list.flatMap((e) => (isBlockEntity(e) ? expandBlockInstance(e) : [e])) as AnySceneEntity[])
    : list;
  return flat.length > 0 ? calculateBounds(flat) : FALLBACK_BOUNDS;
}
