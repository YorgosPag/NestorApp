/**
 * dxf-3d-floor-scope — SSoT for WHICH DXF floor plane(s) the 3D raw-DXF edit / hover path
 * operates over, honouring the active `floor3DScope` (ADR-537 δ / ADR-399 Phase B).
 *
 * This is the pick/seat-side mirror of {@link dxf-overlay-resync} (which makes the *render*
 * honour the scope): both read the SAME scope flag so what you SEE is what you can pick.
 *   'all'    → the multi-floor DXF stack ({@link multi-floor-dxf-source}), each floor's plan
 *              at its datum-relative elevation.
 *   'single' → the active overlay scene at the ACTIVE STOREY's datum-relative FFL
 *              (ADR-399 Φάση Ε; was hardcoded Y=0 before).
 *
 * ADR-399 Φάση Ε — this module is now the SOLE answer to «which DXF plane, at what Y», for the
 * render path too: `resyncDxfOverlay` reads its entry instead of re-deriving the elevation. The
 * «what you SEE is what you can PICK» invariant is therefore MECHANICAL, not merely documented —
 * one function, one number, structurally impossible to drift apart.
 *
 * Plain functions reading stores via `getState()` — safe to call at event time from the
 * non-React pointer handlers + the edit hook (ADR-040: no subscription here).
 */

import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfPickFloor } from '../grips/dxf-wireframe-hit-test';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { getMultiFloorDxfStack } from './multi-floor-dxf-source';

/** One DXF floor in the active scope: its scene + elevation (mm) + linked level id (null = single). */
export interface DxfFloorScopeEntry extends DxfPickFloor {
  readonly levelId: string | null;
}

/**
 * The DXF floor planes the 3D edit/hover path should pick + seat over, honouring the active
 * `floor3DScope`. Empty when there is nothing to draw/pick.
 */
export function getDxfFloorScope(): readonly DxfFloorScopeEntry[] {
  if (useViewMode3DStore.getState().floor3DScope === 'all') {
    return getMultiFloorDxfStack();
  }
  const scene = useDxfOverlay3DStore.getState().dxfScene;
  if (!scene) return [];
  // ADR-399 Φάση Ε / ADR-448 — the storey datum SSoT: the SAME store+field the single-floor BIM
  // sync (`bim3d-resync`) and the 3D cut plane (`cut-plane-3d`) already read. Zero new elevation
  // math here. `0` when no floor is linked (degenerate) = the legacy ground-plane behaviour.
  return [{
    scene,
    floorElevationMm: useActiveStoreyStore.getState().context?.floorElevationMm ?? 0,
    levelId: null,
  }];
}

/**
 * Resolve a raw DXF entity by id across the active floor scope, returning the entity with its
 * floor's elevation (mm) + the owning scene (needed for the per-floor unit scale). Null when
 * the id is on no visible floor. The first matching floor wins (entity ids are unique per
 * floor file). (ADR-537 δ.)
 */
export function findDxfEntityInScope(
  entityId: string,
): { entity: DxfEntityUnion; floorElevationMm: number; scene: DxfScene } | null {
  for (const floor of getDxfFloorScope()) {
    const entity = floor.scene.entities.find((e) => e.id === entityId);
    if (entity) return { entity, floorElevationMm: floor.floorElevationMm, scene: floor.scene };
  }
  return null;
}
