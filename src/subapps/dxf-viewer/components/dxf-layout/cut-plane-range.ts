/**
 * ADR-452 — cut-plane slider range math (PURE, no React / no Firebase).
 *
 * Split out from `useCutPlaneRange.ts` so the datum math is unit-testable without
 * pulling the Firestore-backed `useFloorsByBuilding` into the test environment.
 * All values are **mm, datum-relative** (ground = 0), matching the frame the BIM
 * renderers compare against (`ViewRange.cutPlaneMm`).
 */

import type { FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../bim-3d/scene/floor-stack-elevation';

/** Fallback storey height (mm) when a floor has no `height` (mirrors DEFAULT_FLOOR_HEIGHT_M). */
export const FALLBACK_FLOOR_HEIGHT_MM = 3000;

export interface CutPlaneTick {
  /** Datum-relative elevation (mm). */
  readonly mm: number;
  /** Floor label (longName → name → «#n»). */
  readonly label: string;
}

export interface CutPlaneRange {
  /** Lowest slider value (mm) — min floor FFL, never above 0 (ground). */
  readonly minMm: number;
  /** Highest slider value (mm) — top of the uppermost storey. */
  readonly maxMm: number;
  /** Sensible default cut elevation (mm) — the active storey ceiling, else `maxMm`. */
  readonly defaultMm: number;
  /** Per-floor FFL tick marks, ascending. */
  readonly ticks: readonly CutPlaneTick[];
}

/** Build the slider range + ticks from the building's floor list (null = no floors). */
export function computeCutPlaneRange(
  floors: readonly FloorOption[],
  activeCeilingMm: number | null,
): CutPlaneRange | null {
  if (floors.length === 0) return null;

  const datumM = resolveBuildingDatumElevationM(floors);
  const ticks: CutPlaneTick[] = floors.map((f) => ({
    mm: resolveFloorDatumRelativeElevationMm(f.elevation, datumM),
    label: f.longName || f.name || `#${f.number}`,
  }));

  const tickMms = ticks.map((t) => t.mm);
  const minMm = Math.min(0, ...tickMms);
  const maxMm = Math.max(
    ...floors.map(
      (f) =>
        resolveFloorDatumRelativeElevationMm(f.elevation, datumM) +
        (typeof f.height === 'number' ? f.height * 1000 : FALLBACK_FLOOR_HEIGHT_MM),
    ),
  );

  const defaultMm =
    activeCeilingMm !== null && activeCeilingMm > minMm && activeCeilingMm <= maxMm
      ? activeCeilingMm
      : maxMm;

  return { minMm, maxMm, defaultMm, ticks };
}
