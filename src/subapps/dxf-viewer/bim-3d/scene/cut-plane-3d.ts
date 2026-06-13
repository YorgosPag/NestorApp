/**
 * ADR-452 — cut-plane 3D resolver (store wiring).
 *
 * Reads the single cut-plane SSoT (`cutPlaneActive` + `viewRange.cutPlaneMm` from
 * the BIM render-settings store) plus the active storey FFL and active building
 * base, and returns the world-Y of the horizontal section plane — or `null` when
 * the cut plane is inactive. Consumed by `SectionSceneController` (the single
 * owner of the scene's clipping planes).
 */

import type * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { computeCutPlaneWorldY, buildCutPlane } from './cut-plane-3d-math';

export { computeCutPlaneWorldY, buildCutPlane, MM_TO_M } from './cut-plane-3d-math';

/** Active building base elevation (metres). Falls back to the first building, else 0. */
export function resolveActiveBuildingBaseElevationM(): number {
  const s = useBim3DEntitiesStore.getState();
  const building = s.activeBuildingId
    ? s.buildings.find((b) => b.id === s.activeBuildingId)
    : s.buildings[0];
  return building?.baseElevation ?? 0;
}

/** World-Y (metres) of the cut plane, or `null` when the cut plane is off. */
export function resolveCutPlaneWorldY(): number | null {
  const rs = useBimRenderSettingsStore.getState();
  if (!rs.cutPlaneActive) return null;
  const floorElevationMm = useActiveStoreyStore.getState().context?.floorElevationMm ?? 0;
  return computeCutPlaneWorldY(
    floorElevationMm,
    rs.viewRange.cutPlaneMm,
    resolveActiveBuildingBaseElevationM(),
  );
}

/** Build the active cut plane, or `null` when off. */
export function resolveCutPlane(): THREE.Plane | null {
  const worldY = resolveCutPlaneWorldY();
  return worldY === null ? null : buildCutPlane(worldY);
}
