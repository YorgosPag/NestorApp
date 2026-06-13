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
 * SSoT — the active storey's floor-to-ceiling clear height (mm), **FLOOR-RELATIVE**
 * (ADR-450 §2). The single number that BOTH vertically-extruded structure (walls/
 * columns, stored as `params.height`) AND ceiling-bound structure (beams/slabs,
 * stored as floor-relative top FFL) resolve to — so a column's top and a beam's
 * top can never structurally diverge.
 *
 * Canonical source = `floor.height` (`storey.storeyHeightMm`), NOT the inter-floor
 * gap (`nextFloorElevationMm − floorElevationMm`). Rationale (ADR-450):
 *   1. Robust to a stale upper-floor elevation — the exact dual-source bug that
 *      produced a beam-top of 3000 while the column was 5000.
 *   2. Matches the server cascade (`floor-height-cascade.service.ts`), which
 *      derives beam `topElevation` from `floor.height`, not the gap.
 *   3. Correct when an intermediate floor is missing — the storey is one height
 *      tall (gap would wrongly give 2× height).
 * The ADR-450 floor-elevation cascade keeps `gap === floor.height`, so for
 * consistent data this equals the old gap formula exactly (μηδέν regression).
 *
 * Returns `null` when there is no active storey (degenerate → caller falls back
 * to its legacy per-entity constant).
 */
export function resolveStoreyCeilingRelativeMm(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number | null {
  return storey?.storeyHeightMm ?? null;
}

/**
 * Storey-aware entity height (mm) for walls & columns: explicit ribbon override
 * wins, else the active storey's floor-to-ceiling clear height (SSoT,
 * {@link resolveStoreyCeilingRelativeMm}), else the legacy per-entity constant.
 * ADR-448 Phase 2 · ADR-450 §2.
 */
export function resolveStoreyHeightMm(
  overrideHeight: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  return overrideHeight ?? resolveStoreyCeilingRelativeMm(storey) ?? fallbackMm;
}

/**
 * Storey-aware ceiling/roof slab top-face FFL & beam top (mm), **FLOOR-RELATIVE**.
 *
 * Entities in the single-floor editing scope are created level-relative with
 * FFL = 0 (see `column-from-grid.ts` `ACTIVE_LEVEL_FLOOR_MM = 0`), and the slab
 * `levelElevation` is "top face = FFL" with the ceiling default 3000 meaning
 * "storey 3.00m" (`slab-types.ts` `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`).
 *
 * ADR-450 §2 — unified onto the SAME SSoT as the column/wall height
 * ({@link resolveStoreyCeilingRelativeMm} = `floor.height`), so beam/slab tops and
 * column tops resolve to ONE number and cannot diverge. Precedence: explicit
 * override → floor-relative storey ceiling → legacy per-kind constant.
 */
export function resolveStoreyCeilingElevationMm(
  overrideElevation: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  return overrideElevation ?? resolveStoreyCeilingRelativeMm(storey) ?? fallbackMm;
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
