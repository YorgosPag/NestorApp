/**
 * ADR-452 — «Όλοι οι όροφοι» cut-plane slider range (PURE, no React/Three).
 *
 * In single-floor scope the horizontal cut is FFL-relative to the active storey
 * (`cut-plane-range.ts`, range `0…storeyHeight`). In the «Όλοι οι όροφοι» (all
 * floors) 3D scope the model is the whole stacked building, so the slider must
 * span the **actual occupied vertical envelope** — from the bottom of the lowest
 * piece of material to the top of the highest (Giorgio 2026-06-20). This must be
 * the real entity Z-extent, NOT the storey FFL band: e.g. πέδιλα (foundations)
 * hang BELOW their floor's FFL (`topElevationMm` negative), so an FFL-band range
 * would miss them.
 *
 * Each {@link FloorCutExtent} already carries the floor's material extent in the
 * **datum-relative building frame** (mm, ADR-369) — the hook resolves it by
 * reusing the render-path SSoT `getEntityZExtents` per entity + the floor's
 * `floorElevationMm`. Empty floors *between* two occupied floors are covered
 * automatically because the result is a single continuous `[min, max]` band.
 *
 * @see ./cut-plane-range.ts (single-floor counterpart)
 * @see ../../bim/visibility/entity-z-extents.ts (per-entity Z SSoT, reused)
 */

import type { CutPlaneRange } from './cut-plane-range';

/**
 * One floor's occupied vertical envelope, in the datum-relative building frame.
 * `minMm`/`maxMm` are only meaningful when `hasEntities` is true.
 */
export interface FloorCutExtent {
  /** True when this floor carries ≥1 DXF or BIM entity. */
  readonly hasEntities: boolean;
  /** Datum-relative bottom of all material on this floor (mm). */
  readonly minMm: number;
  /** Datum-relative top of all material on this floor (mm). */
  readonly maxMm: number;
}

/**
 * Build the slider range across every floor that carries entities, spanning the
 * union of their material envelopes. Returns `null` when no floor is occupied or
 * the envelope is degenerate (slider hides, matching the single-floor no-storey
 * behaviour).
 *
 * `bottomMarginMm` extends the low end a hair BELOW the lowest material bottom so
 * the cut can sit strictly under it: the 2D hide-gate hides an entity only when
 * its base is strictly ABOVE the cut (`zBottom > cut`), so without this the lowest
 * piece (e.g. πέδιλα) could never be hidden — the slider would stop exactly at its
 * base. Harmless in 3D (vertex clipping already hides it at its bottom).
 */
export function computeMultiFloorCutRange(
  floors: readonly FloorCutExtent[],
  bottomMarginMm = 0,
): CutPlaneRange | null {
  let minMm = Infinity;
  let maxMm = -Infinity;

  for (const f of floors) {
    if (!f.hasEntities) continue;
    if (f.minMm < minMm) minMm = f.minMm;
    if (f.maxMm > maxMm) maxMm = f.maxMm;
  }

  if (!Number.isFinite(minMm) || !Number.isFinite(maxMm) || maxMm <= minMm) {
    return null;
  }
  // Default = top → whole occupied stack visible first, then slide down
  // (mirrors the single-floor `defaultMm = storeyHeight`).
  return { minMm: minMm - bottomMarginMm, maxMm, defaultMm: maxMm };
}
