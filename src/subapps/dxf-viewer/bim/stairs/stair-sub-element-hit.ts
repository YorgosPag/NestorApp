/**
 * stair-sub-element-hit — 2D per-tread pick (ADR-358 Q19 Φ3a).
 *
 * Resolves which tread sub-element sits under a world-XY point, WITHOUT touching
 * the whole-entity `StairRenderer.hitTest` contract (which stays a bbox test for
 * normal entity selection). The 2D click-into gesture (Φ3b) calls this only when
 * a stair is already the sole-selected entity — mirror of the 3D raycast path.
 *
 * Index convention: iterates the GLOBAL build-order tread list
 * (`[...treadsBelowCut, ...treadsAboveCut]`), so the returned 0-based index
 * aligns with `perTreadOverrides[i]`, the 3D `stairComponentIndex` tag and the
 * selection store — the SAME key across 2D, 3D and the override table.
 *
 * Reuses the `pointInPolygon` SSoT (ray casting). When treads overlap (the small
 * nosing band where tread i's nose overhangs tread i+1's back), the tread with
 * the HIGHER elevation wins — the visually topmost step, matching the 3D raycast.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Polygon3D } from '../types/stair-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import type { StairSubElementRef } from './stair-sub-element-selection-store';

/**
 * Structural subset of `StairEntity` this module reads — a full `StairEntity` is
 * assignable, but decoupling from it keeps the pick pure and unit-testable.
 */
export interface StairHitInput {
  readonly id: string;
  readonly geometry?: {
    readonly treadsBelowCut: readonly Polygon3D[];
    readonly treadsAboveCut?: readonly Polygon3D[];
  } | null;
}

/** Global build-order tread list — SSoT index base for pick / material / tag. */
export function stairTreadsInBuildOrder(stair: StairHitInput): readonly Polygon3D[] {
  const geom = stair.geometry;
  if (!geom) return [];
  return [...geom.treadsBelowCut, ...(geom.treadsAboveCut ?? [])];
}

/**
 * The tread sub-element under `point`, or null. Picks the highest-elevation tread
 * among those containing the point (topmost step at an overhang overlap).
 */
export function hitTestStairSubElement(
  stair: StairHitInput,
  point: Point2D,
): StairSubElementRef | null {
  const treads = stairTreadsInBuildOrder(stair);
  let best = -1;
  let bestZ = -Infinity;
  for (let i = 0; i < treads.length; i++) {
    const tread = treads[i]!;
    if (tread.length >= 3 && pointInPolygon(point, tread)) {
      const z = tread[0]?.z ?? 0;
      if (z >= bestZ) {
        bestZ = z;
        best = i;
      }
    }
  }
  return best >= 0 ? { stairId: stair.id, part: 'tread', index: best } : null;
}
