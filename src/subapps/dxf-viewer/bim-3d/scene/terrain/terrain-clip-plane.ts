/**
 * ADR-665 — terrain level-cut resolver (store wiring).
 *
 * Reads the terrain display SSoT (`terrain-3d-store`), the 3D floor scope, the active storey FFL
 * and the active building base, and returns the terrain's horizontal cut — or `null` when the
 * terrain must not be cut. Consumed by `SectionSceneController`, which stays the SINGLE owner of
 * the scene's clipping planes.
 *
 * Mirrors the `cut-plane-3d-math` ↔ `cut-plane-3d` split (pure math ↔ store reads), and returns a
 * `ResolvedAxisCut` on purpose so the ADR-455 composer (`composeCutEntries` / `composeClipPlanes` /
 * `axisCutCompositionKey`) applies unchanged — zero new composition logic.
 *
 * @module bim-3d/scene/terrain/terrain-clip-plane
 */

import { getTerrain3DState } from '../../../systems/topography/terrain-3d-store';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { resolveActiveBuildingBaseElevationM, type ResolvedAxisCut } from '../cut-plane-3d';
import { computeTerrainClipWorldY } from './terrain-clip-math';

/** ADR-665 — world-Y (metres) of the terrain's level cut from the live SSoT, or `null` when off. */
export function resolveTerrainClipWorldY(): number | null {
  const terrain = getTerrain3DState();
  return computeTerrainClipWorldY({
    autoClip: terrain.autoClipAtActiveLevel,
    terrainVisible: terrain.visible,
    allFloors: useViewMode3DStore.getState().floor3DScope === 'all',
    floorElevationMm: useActiveStoreyStore.getState().context?.floorElevationMm ?? null,
    buildingBaseElevationM: resolveActiveBuildingBaseElevationM(),
  });
}

/**
 * ADR-665 — the terrain cut shaped as a {@link ResolvedAxisCut}, or `null` when off.
 *
 * `sign: 1` keeps everything AT/BELOW the plane — the soil stays, so on «Θεμελίωση» the footings
 * read inside the ground; above it the hill is clipped away.
 */
export function resolveTerrainCut(): ResolvedAxisCut | null {
  const worldY = resolveTerrainClipWorldY();
  return worldY === null ? null : { axis: 'z', worldCoordM: worldY, sign: 1 };
}
