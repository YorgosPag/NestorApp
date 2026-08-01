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
  DRAWING_SCALE_PRESETS,
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

/**
 * ADR-739 §20.8 — the largest scale the AUTOMATIC pass may choose **on its own**:
 * the last entry of {@link DRAWING_SCALE_PRESETS}, i.e. the coarsest scale the
 * View-ribbon widget actually offers.
 *
 * Deliberately DERIVED from the preset ladder rather than hardcoded: the presets
 * are the app's own declared vocabulary of "scales a user draws at". A second
 * literal here would drift from the widget the day someone extends the ladder.
 */
export const MAX_AUTO_DRAWING_SCALE: number =
  DRAWING_SCALE_PRESETS[DRAWING_SCALE_PRESETS.length - 1];

/**
 * The fit-to-paper scale the app is allowed to apply **silently**, or `null` to
 * leave the current scale untouched — the same "no opinion" contract
 * {@link computeFitToPaperScale} already uses for a degenerate scene, so callers
 * need no new branch.
 *
 * ## Why a ceiling exists (the 600-metre table, measured 2026-08-01)
 * A level holding a 1.9 km topographic survey fits an A3 only at 1:5000. That
 * number is arithmetically correct and practically useless: every annotation on
 * the level is then sized for a survey plot, so a 120 sheet-mm table is born
 * **600 m wide** and default 2.5 mm text is born **12.5 m tall**. The fit was not
 * miscalculated — it answered the wrong question ("how does ALL content fit one
 * sheet?") and its answer became the level's permanent annotation scale.
 *
 * Above the ceiling the extent is a *site/survey* extent, not a *drawing* extent,
 * and the guess is out of its competence. It then stands down and the level keeps
 * its current scale (the 1:100 CAD default for a fresh level) instead of writing a
 * value nothing on the level can be read at. A user who genuinely wants 1:1000
 * sets it once in the ribbon and, since ADR-739 §20.8, that choice is persisted
 * and no auto pass may take it back.
 *
 * ⚠️ This ceiling binds the AUTOMATIC pass ONLY. The explicit «Αυτόματη
 * προσαρμογή» menu item keeps calling {@link computeFitToPaperScale} directly: an
 * answer the user asked for out loud must be the honest one, however coarse.
 */
export function computeAutoDrawingScale(
  bounds: Bounds,
  paper: PaperUsableMm = FIT_TO_PAPER_A3_USABLE_MM,
): number | null {
  const fit = computeFitToPaperScale(bounds, paper);
  if (fit == null) return null;
  return fit > MAX_AUTO_DRAWING_SCALE ? null : fit;
}
