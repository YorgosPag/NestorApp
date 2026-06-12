/**
 * active-storey-context — pure SSoT for the «ενεργός όροφος» (active storey) of
 * the single-floor DXF editing scope (ADR-448 Phase 1).
 *
 * Derives ONE immutable context from the building's floor list (καρτέλα «Όροφοι»,
 * via `useFloorsByBuilding`) + the active level's `floorId`. It is the storey-aware
 * replacement for the hardcoded `floorElevationMm=0` / `DEFAULT_COLUMN_HEIGHT_MM=3000`
 * datums in the single-floor path.
 *
 * FULL SSoT: the datum math is **reused** from `floor-stack-elevation.ts` (the same
 * helpers the multi-floor «Όλοι οι όροφοι» aggregator uses) — μηδέν νέα elevation math.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9
 */

import type { FloorKind } from '@/utils/floor-naming';
import { DEFAULT_FLOOR_HEIGHT_M, DEFAULT_FLOOR_FINISH_THICKNESS_MM } from '@/utils/floor-naming';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../bim-3d/scene/floor-stack-elevation';

/** Default storey height (MILLIMETRES) — Greek residential standard (ADR-369). */
export const DEFAULT_STOREY_HEIGHT_MM = DEFAULT_FLOOR_HEIGHT_M * 1000;

/** Minimal floor shape needed to derive the active storey context (FloorOption-compatible). */
export interface StoreyFloorRef {
  readonly id: string;
  /** Signed storey index: negative = basement, 0 = ground, positive = upper. */
  readonly number: number;
  /** METRES — FFL above the building base (ADR-369). */
  readonly elevation?: number | null;
  /** METRES — floor-to-floor height (default DEFAULT_FLOOR_HEIGHT_M). */
  readonly height?: number | null;
  /** MILLIMETRES — FFL → Top-of-Structural-Slab (default DEFAULT_FLOOR_FINISH_THICKNESS_MM). */
  readonly finishThickness?: number | null;
  readonly kind?: FloorKind;
}

/**
 * Immutable storey context for the active single-floor editing scope. All elevation
 * fields are in the **datum-relative frame** (same as `BimSceneLayer.floorElevationMm`),
 * so they drop straight into the 3D render path.
 */
export interface ActiveStoreyContext {
  readonly floorId: string;
  readonly storeyKind: FloorKind | null;
  /** Signed storey index (−=υπόγειο). */
  readonly storeyNumber: number;
  /** floor.height × 1000 (fallback DEFAULT_STOREY_HEIGHT_MM). */
  readonly storeyHeightMm: number;
  /** floor.finishThickness (fallback DEFAULT_FLOOR_FINISH_THICKNESS_MM). */
  readonly finishThicknessMm: number;
  /** Datum-relative FFL of this storey — the single-floor render datum (ADR-448 §4.1). */
  readonly floorElevationMm: number;
  /** Datum-relative FFL of the storey ceiling (next floor up, else FFL + storey height). */
  readonly nextFloorElevationMm: number | null;
  /** True when this is the lowest occupied storey (ισόγειο/υπόγειο) → allows εδαφόπλακα/θεμελίωση. */
  readonly isLowestOccupiedStorey: boolean;
  /** True when any floor is below grade (number<0 ή kind==='basement'). */
  readonly buildingHasBasement: boolean;
}

/** Picks the closest floor above `activeNumber` (smallest number that is greater). */
function pickNextFloorAbove(
  floors: readonly StoreyFloorRef[],
  activeNumber: number,
): StoreyFloorRef | null {
  let best: StoreyFloorRef | null = null;
  for (const f of floors) {
    if (f.number <= activeNumber) continue;
    if (best === null || f.number < best.number) best = f;
  }
  return best;
}

/** Whether `active` is the lowest **occupied** storey (foundation kind excluded). */
function resolveIsLowestOccupied(
  floors: readonly StoreyFloorRef[],
  active: StoreyFloorRef,
): boolean {
  if (active.kind === 'foundation') return false;
  let minOccupied = Infinity;
  for (const f of floors) {
    if (f.kind === 'foundation') continue;
    if (f.number < minOccupied) minOccupied = f.number;
  }
  return Number.isFinite(minOccupied) && active.number === minOccupied;
}

function resolveFiniteNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Builds the active storey context from the building's floor list + active floorId.
 * Returns `null` when there is no active floor link (degenerate — caller falls back
 * to the legacy hardcoded datum).
 */
export function buildActiveStoreyContext(
  floors: readonly StoreyFloorRef[],
  activeFloorId: string | null,
): ActiveStoreyContext | null {
  if (!activeFloorId) return null;
  const active = floors.find((f) => f.id === activeFloorId);
  if (!active) return null;

  const datumM = resolveBuildingDatumElevationM(floors);
  const floorElevationMm = resolveFloorDatumRelativeElevationMm(active.elevation, datumM);
  const storeyHeightMm = resolveFiniteNumber(active.height, DEFAULT_FLOOR_HEIGHT_M) * 1000;
  const next = pickNextFloorAbove(floors, active.number);
  const nextFloorElevationMm = next
    ? resolveFloorDatumRelativeElevationMm(next.elevation, datumM)
    : floorElevationMm + storeyHeightMm;

  return {
    floorId: active.id,
    storeyKind: active.kind ?? null,
    storeyNumber: active.number,
    storeyHeightMm,
    finishThicknessMm: resolveFiniteNumber(active.finishThickness, DEFAULT_FLOOR_FINISH_THICKNESS_MM),
    floorElevationMm,
    nextFloorElevationMm,
    isLowestOccupiedStorey: resolveIsLowestOccupied(floors, active),
    buildingHasBasement: floors.some((f) => f.number < 0 || f.kind === 'basement'),
  };
}
