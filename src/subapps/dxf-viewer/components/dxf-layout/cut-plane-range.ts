/**
 * ADR-452 — cut-plane slider range (PURE, no React).
 *
 * The cut plane is **FFL-relative to the active storey** (Revit View Range is
 * per-level): `cutPlaneMm` = mm above the active floor's base, matching both the
 * 2D entity Z-extents (floor-relative) and the 3D world-Y formula
 * `(floorElevationMm + cutPlaneMm)`. The slider therefore spans `0 … storeyHeight`.
 *
 * Split from the hook so it is unit-testable without React/Firebase.
 */

export interface CutPlaneRange {
  /** Floor base (mm above FFL). Always 0. */
  readonly minMm: number;
  /** Storey ceiling (mm above FFL) = floor-to-floor height. */
  readonly maxMm: number;
  /** Default cut elevation (mm) = ceiling → full storey visible, then slide down. */
  readonly defaultMm: number;
}

/**
 * Build the slider range for the active storey. Returns `null` when no storey
 * height is known (no active floor) — the slider then hides.
 */
export function computeCutPlaneRange(storeyHeightMm: number | null | undefined): CutPlaneRange | null {
  if (typeof storeyHeightMm !== 'number' || !Number.isFinite(storeyHeightMm) || storeyHeightMm <= 0) {
    return null;
  }
  return { minMm: 0, maxMm: storeyHeightMm, defaultMm: storeyHeightMm };
}
