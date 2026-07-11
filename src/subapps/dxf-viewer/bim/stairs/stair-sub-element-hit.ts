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
 * selection store — the SAME key across 2D, 3D and the override table. Rest
 * landings (ADR-637 Φ5) pick against `geometry.landings[]` with the index = its
 * position in that array, matching the 3D landing-mesh `stairComponentIndex` tag.
 *
 * Reuses the `pointInPolygon` SSoT (ray casting). When polygons overlap (the small
 * nosing band where tread i's nose overhangs tread i+1's back, or a landing laid
 * over a flight junction), the one with the HIGHER elevation wins — the visually
 * topmost surface, matching the 3D raycast front face; a landing wins a z-tie
 * because it is the walkable slab resting ON the junction.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 * @see docs/centralized-systems/reference/adrs/ADR-637-stair-rest-landings-ssot.md §5
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
    /** ADR-637 Φ5 — rest-landing slabs, pickable as `part:'landing'`. */
    readonly landings?: readonly Polygon3D[];
  } | null;
}

/** Global build-order tread list — SSoT index base for pick / material / tag. */
export function stairTreadsInBuildOrder(stair: StairHitInput): readonly Polygon3D[] {
  const geom = stair.geometry;
  if (!geom) return [];
  return [...geom.treadsBelowCut, ...(geom.treadsAboveCut ?? [])];
}

/**
 * The index + top elevation of the highest-Z polygon in `polys` that contains
 * `point`, or null. Shared by the tread and landing passes so both use the SAME
 * `pointInPolygon` SSoT ray-cast and overlap tie-break (ADR-584 anti-clone).
 */
function pickHighestContaining(
  polys: readonly Polygon3D[],
  point: Point2D,
): { index: number; z: number } | null {
  let best = -1;
  let bestZ = -Infinity;
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i]!;
    if (poly.length >= 3 && pointInPolygon(point, poly)) {
      const z = poly[0]?.z ?? 0;
      if (z >= bestZ) {
        bestZ = z;
        best = i;
      }
    }
  }
  return best >= 0 ? { index: best, z: bestZ } : null;
}

/**
 * The stair sub-element under `point`, or null. Considers rest landings and
 * treads together, picking the highest-elevation surface (topmost step / slab at
 * an overlap). A landing wins a z-tie — it is the walkable slab resting ON the
 * flight junction, so it should be the click target there.
 */
export function hitTestStairSubElement(
  stair: StairHitInput,
  point: Point2D,
): StairSubElementRef | null {
  const treadHit = pickHighestContaining(stairTreadsInBuildOrder(stair), point);
  const landingHit = pickHighestContaining(stair.geometry?.landings ?? [], point);
  if (landingHit && (!treadHit || landingHit.z >= treadHit.z)) {
    return { stairId: stair.id, part: 'landing', index: landingHit.index };
  }
  if (treadHit) return { stairId: stair.id, part: 'tread', index: treadHit.index };
  return null;
}
