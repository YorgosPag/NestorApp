/**
 * Annotation-scale SSoT — convert a paper-space annotation height (the CAD
 * convention 2.5 mm, ISO 3098) into a model-space height expressed in the active
 * scene units, at a given drawing-scale denominator (the "1:N" the user picks in
 * the View ribbon `DrawingScaleWidget`, ADR-375 / Revit annotation-scale pattern).
 *
 * ## Why this exists (ADR-344 Round 7 — the meters/mm text-size bug)
 * The default height of a ribbon-created TEXT is authored in *paper* millimetres,
 * but the entity stores its height in *model/world* units. The physical height a
 * reader expects is `paperMm × drawingScale` (e.g. 2.5 mm × 100 = 250 mm at
 * 1:100), independent of whether the scene unit is mm, cm or m. The earlier
 * Round-6 fix used a unit-system *heuristic* (`m→100, cm→10, mm→1`) which was
 * inconsistent — it produced 250 mm in metre scenes but only 2.5 mm in the very
 * common model-space-in-mm drawings, i.e. invisible text. This helper folds the
 * single canonical `drawingScale` SSoT through the existing `mmToSceneUnits`
 * converter so every unit system yields the same physical height.
 *
 *   1:100, 2.5 mm paper →  mm: 250  |  cm: 25  |  m: 0.25   (all = 250 mm)
 *
 * @see utils/scene-units.ts — `mmToSceneUnits` SSoT (the only unit math)
 * @see state/drawing-scale-store.ts — `drawingScale` SSoT (Revit annotation scale)
 * @see docs/centralized-systems/reference/adrs/ADR-344-dxf-enterprise-text-engine.md
 */

import { mmToSceneUnits, type SceneUnits } from './scene-units';

/**
 * Paper-space annotation height (mm) → model-space height in `units`, scaled by
 * the drawing-scale denominator. A non-positive or non-finite `drawingScale`
 * defensively collapses to 1 (1:1, paper-equals-model) so the result is never
 * NaN or zero-height.
 */
export function paperHeightToModel(
  paperHeightMm: number,
  drawingScale: number,
  units: SceneUnits,
): number {
  const scale = Number.isFinite(drawingScale) && drawingScale > 0 ? drawingScale : 1;
  return paperHeightMm * scale * mmToSceneUnits(units);
}

/**
 * Effective annotation (DIMSCALE) factor for a dimension. An explicit imported
 * DIMSTYLE scale (`> 1`, e.g. 50 / 100) wins — it is the drawing's own declared
 * plot scale. A built-in or annotative style (`dimscale ≤ 1`, the default) falls
 * back to the canonical `drawingScale` SSoT (the View-ribbon 1:N, default 1:100).
 *
 * This is the dimension counterpart of the ribbon-Text rule (Round 7): every
 * part of a dimension (text, arrowheads, geometry offsets, center mark) must use
 * the SAME factor, resolved ONCE. It is **unit-independent** — it replaces the
 * old renderer heuristic (`unitFactor ≤ m && dimscale < 10`) that only rescued
 * metre scenes, leaving mm/cm dimensions microscopic.
 */
export function resolveEffectiveDimscale(
  rawDimscale: number,
  drawingScale: number,
  rawIsExplicit = false,
): number {
  if (Number.isFinite(rawDimscale) && rawDimscale > 1) return rawDimscale;
  // ADR-362 — an imported style that DECLARES its DIMSCALE (even 1) has already
  // spoken: its sizes are correct as authored, and folding the View-ribbon 1:N
  // on top inflates every imported dimension by that factor. `≤ 1` only means
  // "unset" for built-in templates and the annotative sentinel (DIMSCALE 0),
  // which is why the flag is opt-in rather than the default.
  if (rawIsExplicit && Number.isFinite(rawDimscale) && rawDimscale > 0) return rawDimscale;
  return Number.isFinite(drawingScale) && drawingScale > 0 ? drawingScale : 1;
}

/**
 * Upper bound on dimension text height as a fraction of the scene's longest span.
 * ISO/CAD annotations sit around 1.5–3 % of the drawing extent; 2 % is a safe
 * ceiling — a label taller than that is illegible clutter, not annotation.
 */
export const DIM_TEXT_MAX_SCENE_RATIO = 0.02;

/**
 * ADR-362 — readability clamp for imported DIMSCALE (the "giant dimension cross"
 * fix). Some DXFs declare a plot `DIMSCALE` (e.g. 100 for 1:100) that is wildly
 * mismatched to the drawing's real extent — typically a units mismatch upstream
 * (mm-declared file authored in metres). The result is dimension text taller than
 * ~20 % of the whole drawing, so every label overlaps into an unreadable blob.
 *
 * This caps the EFFECTIVE dimscale so the model-space text height never exceeds
 * `maxTextRatio × sceneSpan`. It is **clamp-only (never enlarges)**: a drawing
 * whose text is already ≤ the ceiling is returned untouched, so correctly-authored
 * DXFs are unaffected. Uniform across the scene (one `sceneSpan`) → all labels keep
 * the SAME height (CAD convention), unlike a per-dimension cap. Idempotent: feeding
 * the clamped value back returns it unchanged.
 *
 * A non-positive/non-finite `sceneSpan` or `dimtxt` (preview path, empty scene)
 * is a no-op — the resolved dimscale passes through verbatim.
 *
 * @param effectiveDimscale  Output of `resolveEffectiveDimscale` (already healed).
 * @param dimtxt             Paper-space text height (mm) from the DIMSTYLE.
 * @param units              Active scene unit system (drives paper→model factor).
 * @param sceneSpan          Longest side of the scene bounds, in scene/model units.
 * @param maxTextRatio       Ceiling as a fraction of `sceneSpan` (default 2 %).
 */
export function clampDimscaleForReadability(
  effectiveDimscale: number,
  dimtxt: number,
  units: SceneUnits,
  sceneSpan: number,
  maxTextRatio: number = DIM_TEXT_MAX_SCENE_RATIO,
): number {
  if (!(sceneSpan > 0) || !(dimtxt > 0) || !(effectiveDimscale > 0)) return effectiveDimscale;
  const textHeight = paperHeightToModel(dimtxt, effectiveDimscale, units);
  const maxHeight = sceneSpan * maxTextRatio;
  if (!(textHeight > maxHeight)) return effectiveDimscale;
  return effectiveDimscale * (maxHeight / textHeight);
}
