/**
 * storey-creation-defaults — SSoT for inheriting BIM creation defaults from the
 * {@link ActiveStoreyContext} at the moment a new entity is born (ADR-448 Phase 2).
 *
 * ONE place reads the active-storey store (non-React `getState()`, mirroring how
 * `bim3d-resync` consumes `Bim3DEntitiesStore`) and applies the canonical
 * precedence:
 *
 *     explicit override → active-storey default → legacy constant fallback
 *
 * Pure-ish: deterministic given the store state. When the store holds `null`
 * (no active floor link / initial state) every resolver collapses to the legacy
 * constant, so existing call sites (and their unit tests) keep their exact
 * behaviour — μηδέν regression by construction. Builders inject the `storey`
 * argument in tests for store-free determinism.
 *
 * @see systems/levels/active-storey-context.ts — the context shape + builder
 * @see systems/levels/active-storey-store.ts — the Zustand SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md §6 Phase 2
 */

import { useActiveStoreyStore } from './active-storey-store';
import type { ActiveStoreyContext } from './active-storey-context';

/**
 * Non-React read of the active storey context (SSoT). Safe in pure builders /
 * completion handlers — plain Zustand `getState()`, no hook rules apply (same
 * pattern as `bim3d-resync.ts`).
 */
export function readActiveStoreyContext(): ActiveStoreyContext | null {
  return useActiveStoreyStore.getState().context;
}

/**
 * Storey-aware entity height (mm) for walls & columns: explicit ribbon override
 * wins, else the active storey's floor-to-floor height, else the legacy
 * per-entity constant. ADR-448 Phase 2.
 */
export function resolveStoreyHeightMm(
  overrideHeight: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  return overrideHeight ?? storey?.storeyHeightMm ?? fallbackMm;
}

/**
 * Storey-aware ceiling/roof slab top-face FFL (mm), **FLOOR-RELATIVE**.
 *
 * Entities in the single-floor editing scope are created level-relative with
 * FFL = 0 (see `column-from-grid.ts` `ACTIVE_LEVEL_FLOOR_MM = 0`), and the slab
 * `levelElevation` is "top face = FFL" with the ceiling default 3000 meaning
 * "storey 3.00m" (`slab-types.ts` `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`). So the
 * storey-derived ceiling must be the floor-to-next-floor HEIGHT
 * (`nextFloorElevationMm − floorElevationMm`), NOT the absolute datum-relative
 * `nextFloorElevationMm` (which would place an upper-storey ceiling at the
 * building-wide elevation, e.g. 10500 instead of 3500).
 *
 * Precedence: explicit override → floor-relative storey ceiling → legacy
 * per-kind constant. Only the active storey with a resolvable next-floor
 * elevation contributes; otherwise the fallback is used.
 */
export function resolveStoreyCeilingElevationMm(
  overrideElevation: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  if (overrideElevation !== undefined) return overrideElevation;
  if (storey != null && storey.nextFloorElevationMm != null) {
    return storey.nextFloorElevationMm - storey.floorElevationMm;
  }
  return fallbackMm;
}

/**
 * Whether creating a foundation / ground-bearing slab on the active storey
 * deserves a soft warning — i.e. the active storey is NOT the lowest occupied
 * one. Revit-style: foundations belong at the lowest level, but the engineer is
 * allowed to place them anywhere (warn, don't block). Returns `false` when there
 * is no active storey (degenerate → no opinion → no warning).
 */
export function shouldWarnFoundationOnStorey(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): boolean {
  return storey !== null && storey.isLowestOccupiedStorey === false;
}
