/**
 * ADR-375 Phase B.4 — Fit-to-paper AUTO drawing scale (pure SSoT).
 *
 * Chooses a standard annotation-scale denominator (1:N) so the scene's bounding
 * box fits on a reference sheet (A3 by default). This is the industry-standard
 * "plot scale" rule (AutoCAD/Revit): the physical text height a reader expects is
 * `DIMTXT(paper mm) × N`, so a scene framed at 1:50 renders 2.5 mm text as 125 mm
 * in the model — proportional to the geometry instead of the fixed-1:100 default
 * that made annotations look oversized on small drawings.
 *
 * Orientation-agnostic: the scene's LONG side is matched to the paper's LONG side
 * (a portrait scene fits a landscape sheet). The raw ratio is then snapped UP to
 * the nearest standard 1-2-5 scale (…50, 100, 200, 500, 1000…) so the value is a
 * scale an engineer actually uses, never an odd 1:48.
 *
 * Reuses (no re-implementation):
 *   - `getBoundsDimensions` (utils/bounds-utils) — the Bounds → {width,height} SSoT.
 *   - `DRAWING_SCALE_MIN/MAX` + `FIT_TO_PAPER_A3_USABLE_MM` (config) — the clamp
 *     window + reference paper, shared with the store + widget.
 *
 * Units: `bounds` is in canonical world mm (same space as `scene.bounds` /
 * `createCombinedBounds`), matching the paper mm — so the ratio is dimensionless.
 */

import { getBoundsDimensions, type Bounds } from '../../utils/bounds-utils';
import {
  DRAWING_SCALE_MIN,
  DRAWING_SCALE_MAX,
  FIT_TO_PAPER_A3_USABLE_MM,
} from '../../config/bim-render-settings-types';

/** Usable paper area (mm), orientation-agnostic. */
export interface PaperUsableMm {
  readonly long: number;
  readonly short: number;
}

/**
 * Smallest standard 1-2-5 scale `≥ raw` (…, 50, 100, 200, 500, 1000, …), clamped
 * to `[DRAWING_SCALE_MIN, DRAWING_SCALE_MAX]`. The 1-2-5 progression is the CAD
 * standard-scale ladder and is a strict superset of `DRAWING_SCALE_PRESETS`.
 */
export function niceScaleAtLeast(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return DRAWING_SCALE_MIN;
  const mantissas = [1, 2, 5];
  for (let exp = 0; exp <= 4; exp++) {
    const decade = Math.pow(10, exp);
    for (const m of mantissas) {
      const cand = m * decade;
      if (cand >= raw) return Math.min(cand, DRAWING_SCALE_MAX);
    }
  }
  return DRAWING_SCALE_MAX;
}

/**
 * Fit-to-paper drawing scale for a scene's bounds. Returns `null` for a
 * degenerate/empty scene (both spans ≤ 0) so callers can leave the current scale
 * untouched instead of snapping to a meaningless 1:1.
 *
 * @param bounds  Scene bounds in world mm (e.g. `createCombinedBounds` output).
 * @param paper   Usable sheet area (mm). Defaults to A3 usable (400×277).
 */
export function computeFitToPaperScale(
  bounds: Bounds,
  paper: PaperUsableMm = FIT_TO_PAPER_A3_USABLE_MM,
): number | null {
  const { width, height } = getBoundsDimensions(bounds);
  const sceneLong = Math.max(width, height);
  const sceneShort = Math.min(width, height);
  if (!(sceneLong > 0)) return null;

  // Match long→long, short→short; the binding axis is the larger ratio so BOTH
  // scene dimensions fit inside the sheet.
  const raw = Math.max(sceneLong / paper.long, sceneShort / paper.short);
  const snapped = niceScaleAtLeast(raw);
  return Math.max(DRAWING_SCALE_MIN, Math.min(DRAWING_SCALE_MAX, snapped));
}
