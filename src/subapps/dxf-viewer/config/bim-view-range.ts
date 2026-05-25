/**
 * ADR-375 — View Range (Revit-equivalent, Tier 0)
 *
 * 4 horizontal planes per plan view, in millimeters above level base.
 * Determines cut/projection/beyond/hidden state per entity at render time.
 *
 * Phase A: hard-coded defaults (cut=1200mm).
 * Phase C: per-view UI + Firestore persistence.
 */

export interface ViewRange {
  /** Upper limit of primary range (mm). Elements above NOT shown. */
  topMm: number;
  /** Cut plane elevation (mm). Elements intersecting → CUT state. */
  cutPlaneMm: number;
  /** Lower limit of primary range (mm). */
  bottomMm: number;
  /** Lower limit of view depth (mm). Elements within → <Beyond> state. */
  viewDepthMm: number;
  /** Special-case range below Bottom (mm) — Floors/Stairs/Ramps draw as projection. */
  floorAdjustedRangeMm: number;
}

/** Revit Architectural Template default for floor plans. */
export const DEFAULT_VIEW_RANGE: ViewRange = {
  topMm: 2300,
  cutPlaneMm: 1200,
  bottomMm: 0,
  viewDepthMm: -300,
  floorAdjustedRangeMm: 1220,
} as const;

/** Display state for an element at render time. */
export type CutState = 'cut' | 'projection' | 'beyond' | 'hidden';

/** Z-extents of an entity (mm above level base). */
export interface EntityZExtents {
  zBottomMm: number;
  zTopMm: number;
  /** Category needed for floor/stair/ramp exception rule. */
  category: 'wall'|'column'|'beam'|'slab'|'opening'|'slab-opening'|'stair'|'roof'|'ceiling'|'dimension'|'hatch'|'grip';
}

/**
 * Return the effective ViewRange for a level, merging stored overrides with defaults.
 * Accepts the raw optional subfield from Level.bimRenderSettings.
 */
export function resolveViewRange(
  overrides?: Partial<ViewRange> | null,
): ViewRange {
  if (!overrides) return DEFAULT_VIEW_RANGE;
  return { ...DEFAULT_VIEW_RANGE, ...overrides };
}

/**
 * Derive display state from Revit view-range rules.
 *
 * Per verified Revit display rules (2026-05-25):
 *  1. zBottom > topMm                         → hidden
 *  2. zBottom ≤ cutPlaneMm ≤ zTop             → cut
 *  3. Within primary range, not cutting        → projection
 *  4. Below bottomMm, within viewDepthMm:
 *       Floor/Slab/Stair within floorAdjustedRangeMm below → projection (exception)
 *       Other categories → beyond
 *  5. Below viewDepthMm                        → hidden
 */
export function resolveCutState(entity: EntityZExtents, range: ViewRange): CutState {
  const { zBottomMm, zTopMm, category } = entity;
  const { topMm, cutPlaneMm, bottomMm, viewDepthMm, floorAdjustedRangeMm } = range;

  if (zBottomMm > topMm) return 'hidden';

  if (zBottomMm <= cutPlaneMm && cutPlaneMm <= zTopMm) return 'cut';

  if (zTopMm >= bottomMm && zBottomMm <= topMm) return 'projection';

  if (zTopMm < bottomMm) {
    const isFloorLike = category === 'slab' || category === 'stair' || category === 'slab-opening';
    if (isFloorLike && zTopMm >= bottomMm - floorAdjustedRangeMm) return 'projection';
    if (zTopMm >= viewDepthMm) return 'beyond';
  }

  return 'hidden';
}
