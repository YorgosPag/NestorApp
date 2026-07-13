/**
 * bim3d-resync — scope-aware SSoT for rebuilding the 3D BIM scene.
 *
 * ADR-399 Phase B. Before this helper, ~6 call sites (BimViewport3D mount +
 * entity subscription, use-bim3d-store-sync floor-mode / LayerStore, and
 * use-bim3d-vg-resync V/G / envelope) each inlined the same
 * `manager.syncBimEntities(storeSnapshot, 0, …)` block. With the "Όλοι οι
 * όροφοι" scope those single-floor rebuilds would wipe the stacked building on
 * every layer / V/G / floor-mode change. Centralising them here:
 *   - removes the duplication (N.0.2 Boy-Scout), and
 *   - makes every trigger automatically respect `floor3DScope`:
 *       'all'    → `syncBimEntitiesMultiFloor(stack)` + floor-visibility pass,
 *       'single' → `syncBimEntities(activeLevelSnapshot)` (legacy behaviour).
 *
 * Reads stores synchronously via `getState()` so it is safe to call from the
 * non-React store subscribers above.
 */

import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import {
  useBim3DEntitiesStore,
  EMPTY_BIM_ENTITIES,
  type Bim3DEntities,
} from '../stores/Bim3DEntitiesStore';
import { getMultiFloorStack } from './multi-floor-3d-source';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import type { ThreeJsSceneManager } from './ThreeJsSceneManager';
import { EMPTY_FLOOR_VIS_SCOPE, type FloorVisibilityScope } from './scene-manager-actions';
import type { FloorVisMode } from '../utils/floor-visibility-state';

/** Map the live entities-store snapshot + floor modes → the shared {@link FloorVisibilityScope}. */
function buildFloorVisibilityScope(
  s: ReturnType<typeof useBim3DEntitiesStore.getState>,
  floorModes: ReadonlyMap<string, FloorVisMode>,
): FloorVisibilityScope {
  return {
    floors: s.floors,
    buildings: s.buildings,
    activeBuildingId: s.activeBuildingId,
    buildingVisModes: s.buildingVisibilityModes,
    floorVisModes: floorModes,
  };
}

export interface ResyncBimSceneOpts {
  /** ADR-371 read-only Properties pipeline — entities come from a prop, not the store. */
  readonly externalEntitiesMode: boolean;
  /** External entity feed (only consulted when `externalEntitiesMode`). */
  readonly bimEntities?: Bim3DEntities | null;
}

/**
 * Rebuild the BIM scene for `manager` using the current store snapshot, honoring
 * the active `floor3DScope`. No-op when `manager` is null.
 */
export function resyncBimScene(
  manager: ThreeJsSceneManager | null,
  opts: ResyncBimSceneOpts,
): void {
  if (!manager) return;
  const vm = useViewMode3DStore.getState();
  const floorModes = vm.floorVisibilityModes;
  const s = useBim3DEntitiesStore.getState();

  // "Όλοι οι όροφοι" — only on the live /dxf/viewer pipeline (never external).
  if (vm.floor3DScope === 'all' && !opts.externalEntitiesMode) {
    manager.syncBimEntitiesMultiFloor(
      getMultiFloorStack(),
      buildFloorVisibilityScope(s, floorModes),
    );
    // Defense-in-depth: ghost/hide styling for already-built per-floor meshes.
    manager.applyFloorVisibility(floorModes);
    return;
  }

  if (opts.externalEntitiesMode) {
    manager.syncBimEntities(
      opts.bimEntities ?? EMPTY_BIM_ENTITIES,
      0, undefined,
      { ...EMPTY_FLOOR_VIS_SCOPE, floorVisModes: floorModes },
    );
    return;
  }

  // ADR-448 Phase 1 — storey-aware render datum (real FFL) + storey ceiling for
  // `storey-ceiling` walls/columns. Read once from the dedicated store; both fall
  // back (0 / undefined) when no floor is linked, preserving legacy behaviour.
  const storey = useActiveStoreyStore.getState().context;
  manager.syncBimEntities(
    { walls: s.walls, columns: s.columns, beams: s.beams, foundations: s.foundations, slabs: s.slabs,
      slabOpenings: s.slabOpenings, openings: s.openings, stairs: s.stairs,
      fixtures: s.fixtures, panels: s.panels, manifolds: s.manifolds, radiators: s.radiators, boilers: s.boilers, waterHeaters: s.waterHeaters, railings: s.railings,
      furnitures: s.furnitures, roofs: s.roofs, floorFinishes: s.floorFinishes, underfloors: s.underfloors, mepSegments: s.mepSegments, mepFittings: s.mepFittings },
    storey?.floorElevationMm ?? 0,
    s.activeLevelId ?? undefined,
    buildFloorVisibilityScope(s, floorModes),
    storey?.nextFloorElevationMm ?? undefined,
  );
}
