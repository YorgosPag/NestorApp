/**
 * ADR-665 — terrain level-cut math (PURE, no stores → unit-testable without Firebase).
 *
 * The topographic relief is cut by a horizontal plane at the ACTIVE LEVEL's elevation, so an
 * engineer working on the 1st floor is not buried in soil. The BUILDING is never cut by this
 * plane — that separation is enforced downstream by the `'topo'` clip scope
 * (`section-clip-applicator`); this module only answers WHERE the plane sits.
 *
 * Mirrors the `cut-plane-3d-math` ↔ `cut-plane-3d` split: pure math here, store reads in
 * `terrain-clip-plane`.
 *
 * @module bim-3d/scene/terrain/terrain-clip-math
 */

import { computeCutPlaneWorldY, CUT_PLANE_KEEP_EPSILON_M } from '../cut-plane-3d-math';

export interface TerrainClipInputs {
  /** ADR-665 store toggle (`Terrain3DState.autoClipAtActiveLevel`). */
  readonly autoClip: boolean;
  /** A hidden hill has nothing to cut — and must not hold a clip plane. */
  readonly terrainVisible: boolean;
  /**
   * `floor3DScope === 'all'` («Όλοι οι όροφοι»). There is no single active level, so «the active
   * level's elevation» is undefined — and semantically the all-floors view IS the site view:
   * whole building + whole ground. Follows ADR-399, which zeroes the FFL offset in this scope for
   * the same reason.
   */
  readonly allFloors: boolean;
  /** Datum-relative FFL of the active storey (mm); `null` when there is no active-storey context. */
  readonly floorElevationMm: number | null;
  /** Active building base offset above site datum (metres). */
  readonly buildingBaseElevationM: number;
}

/**
 * World-Y (metres) of the terrain's level cut, or `null` when the terrain must not be cut.
 *
 * Reuses `computeCutPlaneWorldY(floorElevationMm, cutPlaneMm, base)` — the SAME formula the
 * ADR-452 View Range cut uses — with `cutPlaneMm = 0`, because the terrain cut IS the FFL, not an
 * offset above it. The shared 1 mm epsilon keeps a site graded exactly to FFL from shimmering at
 * `dot == 0` (see `CUT_PLANE_KEEP_EPSILON_M`).
 */
export function computeTerrainClipWorldY(inputs: TerrainClipInputs): number | null {
  const { autoClip, terrainVisible, allFloors, floorElevationMm, buildingBaseElevationM } = inputs;
  if (!autoClip || !terrainVisible || allFloors) return null;
  if (floorElevationMm === null) return null;
  return (
    computeCutPlaneWorldY(floorElevationMm, 0, buildingBaseElevationM) + CUT_PLANE_KEEP_EPSILON_M
  );
}
