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

/** A raw DXF entity resolved in the active floor scope, with everything its consumers need. */
export interface DxfEntityInScope {
  readonly entity: DxfEntityUnion;
  readonly floorElevationMm: number;
  readonly scene: DxfScene;
}

/**
 * Resolve MANY raw DXF entities by id across the active floor scope in ONE pass (ADR-717).
 *
 * Complexity is the whole point: the per-id {@link findDxfEntityInScope} scans every entity of
 * every floor (`Array.find`), so resolving a marquee selection of M ids over a scene of N
 * entities costs O(N·M) — a 2.000-entity survey with 500 selected is a million comparisons, and
 * the selection-glow pass would pay it EVERY frame while the camera orbits. Here the ids go into
 * a `Set` and the scope is walked once: O(N + M), independent of how much is selected.
 *
 * The first matching floor wins per id (entity ids are unique per floor file), matching the
 * per-id resolver exactly (ADR-537 δ). Ids that exist on no visible floor are simply absent from
 * the result — the caller decides what a miss means (`[]` vs skip).
 */
export function findDxfEntitiesInScope(ids: readonly string[]): DxfEntityInScope[] {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  const found = new Map<string, DxfEntityInScope>();
  for (const floor of getDxfFloorScope()) {
    for (const entity of floor.scene.entities) {
      if (!wanted.has(entity.id) || found.has(entity.id)) continue;
      found.set(entity.id, { entity, floorElevationMm: floor.floorElevationMm, scene: floor.scene });
    }
    if (found.size === wanted.size) break; // every id placed — no reason to walk further floors
  }
  // Καλούντος-σειρά, όχι σειρά σκηνής: τα grips/ghosts κρατούν τη σειρά επιλογής (ADR-543).
  return ids.map((id) => found.get(id)).filter((e): e is DxfEntityInScope => e !== undefined);
}

/**
 * Resolve a raw DXF entity by id across the active floor scope, returning the entity with its
 * floor's elevation (mm) + the owning scene (needed for the per-floor unit scale). Null when
 * the id is on no visible floor. The first matching floor wins (entity ids are unique per
 * floor file). (ADR-537 δ.)
 *
 * Thin wrapper over {@link findDxfEntitiesInScope} — one resolution rule, not two that can drift.
 */
export function findDxfEntityInScope(entityId: string): DxfEntityInScope | null {
  return findDxfEntitiesInScope([entityId])[0] ?? null;
}
