/**
 * floor-stack-elevation — pure SSoT for the «Όλοι οι όροφοι» (all floors) 3D
 * stacking datum (ADR-399 Phase B · ADR-369 §9).
 *
 * Revit-grade rule: a building's 3D stack rests on its **datum storey**, which
 * sits at the building base (world Y = `building.baseElevation`, default 0).
 * Every other storey stacks at its elevation **relative to that datum** — so
 * the model sits on the ground instead of floating at the lowest storey's raw
 * `elevation` (which, for a building whose lowest floor is numbered «1ος» = 3 m,
 * would otherwise lift the whole building 3 m off the ground).
 *
 * Datum selection (Revit «Level 1 is the reference»):
 *   1. The ground floor (`number === 0`, kind 'ground') when present — this keeps
 *      a defined basement **below** zero and upper floors above it.
 *   2. Otherwise the lowest storey by elevation (it becomes the de-facto ground).
 *
 * The building-base offset itself is applied downstream by the per-entity
 * converters (`buildingBaseElevationM`, via `resolveEntityBuilding`), so these
 * helpers return the **datum-relative** floor elevation only.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md (Phase B)
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9
 */

import type { FloorKind } from '@/utils/floor-naming';
import { SPECIAL_LEVEL_KINDS } from '@/utils/floor-naming';

/** Minimal floor shape needed to resolve the stacking datum. */
export interface FloorElevationRef {
  /** Signed storey index: negative = basement, 0 = ground (Ισόγειο), positive = upper. */
  readonly number: number;
  /** METRES — floor elevation above the building base (ADR-369). May be absent. */
  readonly elevation?: number | null;
  /**
   * ADR-461 — Revit-style classification. Special levels (foundation / roof /
   * stair-penthouse) must NOT become the stacking datum: a foundation has the
   * lowest elevation, so without this the fallback-min would pick it and lift the
   * whole 3D model by `foundationDepth`. Counted storeys only drive the datum.
   */
  readonly kind?: FloorKind;
}

/** Storey number that denotes the ground floor (Ισόγειο) — the preferred datum. */
const GROUND_FLOOR_NUMBER = 0;

/** True when this floor is a special level (foundation/roof/stair-penthouse) — never a datum. */
function isSpecialLevel(ref: FloorElevationRef): boolean {
  return ref.kind !== undefined && (SPECIAL_LEVEL_KINDS as readonly string[]).includes(ref.kind);
}

/**
 * Resolves the building's stacking datum elevation (metres): the ground floor's
 * elevation when a ground floor exists, otherwise the lowest floor's elevation.
 * Returns 0 for an empty list (degenerate — caller has no floors to stack).
 */
export function resolveBuildingDatumElevationM(
  floors: readonly FloorElevationRef[],
): number {
  if (floors.length === 0) return 0;

  const ground = floors.find(
    (f) => f.number === GROUND_FLOOR_NUMBER && !isSpecialLevel(f),
  );
  if (ground && typeof ground.elevation === 'number' && Number.isFinite(ground.elevation)) {
    return ground.elevation;
  }

  // ADR-461 — fallback to the lowest **counted** storey: a foundation/roof must
  // never become the datum, else the model lifts by foundationDepth. If a building
  // somehow has only special levels, fall back to all floors (degenerate).
  let min = Infinity;
  for (const f of floors) {
    if (isSpecialLevel(f)) continue;
    const e = typeof f.elevation === 'number' && Number.isFinite(f.elevation) ? f.elevation : 0;
    if (e < min) min = e;
  }
  if (!Number.isFinite(min)) {
    for (const f of floors) {
      const e = typeof f.elevation === 'number' && Number.isFinite(f.elevation) ? f.elevation : 0;
      if (e < min) min = e;
    }
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Datum-relative floor elevation in **millimetres** (ADR-369 elevation × 1000),
 * for feeding `BimSceneLayer.syncMultiFloor`'s `floorElevationMm`. The datum
 * storey resolves to 0; floors above are positive, a defined basement negative.
 */
export function resolveFloorDatumRelativeElevationMm(
  floorElevationM: number | null | undefined,
  datumM: number,
): number {
  const e = typeof floorElevationM === 'number' && Number.isFinite(floorElevationM) ? floorElevationM : 0;
  return (e - datumM) * 1000;
}
