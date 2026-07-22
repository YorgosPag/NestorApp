/**
 * FloorVisibilityScope — the floor/building visibility bundle that travels together
 * through EVERY BIM scene-sync path (single-floor + multi-floor).
 *
 * ADR-399 Phase B / ADR-382 Phase C. Extracted as ONE named options object
 * (big-player option-bag convention: Three.js `set(options)`, Revit API option
 * bags, Figma plugin params) so the core `BimSceneLayer.sync`/`syncMultiFloor`,
 * both `ThreeJsSceneManager` wrappers, both scene-manager-actions Args, and all
 * `bim3d-resync` call sites compose it instead of unrolling the same 5 params with
 * the same defaults (CHECK 3.28 token clone, ADR-584).
 *
 * Lives in its own leaf module (not in `scene-manager-actions`) so the low-level
 * `BimSceneLayer` can depend on the scope contract without importing the higher
 * level actions module. Flat by design — the sync internals read `scope.floors`/
 * `scope.buildingVisModes`/… directly. `scene-manager-actions` re-exports both
 * symbols for backward-compatible import paths.
 */

import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import type { FloorVisMode } from '../utils/floor-visibility-state';

export type FloorVisibilityScope = {
  readonly floors: readonly FloorRef[];
  readonly buildings: readonly BuildingRef[];
  readonly activeBuildingId: string | null;
  readonly buildingVisModes: ReadonlyMap<string, BuildingVisMode>;
  /** ADR-382 Phase C — per-level visibility modes for pre-mesh hide filter. */
  readonly floorVisModes: ReadonlyMap<string, FloorVisMode>;
};

/** The empty-scope default (no floors/buildings, all-default visibility) shared by every wrapper's default param. */
export const EMPTY_FLOOR_VIS_SCOPE: FloorVisibilityScope = {
  floors: [],
  buildings: [],
  activeBuildingId: null,
  buildingVisModes: new Map(),
  floorVisModes: new Map(),
};
