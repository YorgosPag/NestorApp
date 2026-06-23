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
