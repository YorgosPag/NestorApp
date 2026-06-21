/**
 * @module bim-body-fill
 * @description SSoT helper για το **translucent body fill** («poché») των BIM 2Δ
 * renderers **που έχουν V/G category tint + single palette fallback** (Wall/Column/
 * Beam/Slab/SlabOpening). Συνθέτει τα ΥΠΑΡΧΟΝΤΑ SSoT primitives σε ΕΝΑ pattern:
 *   `resolveVgFillTint` (ADR-375 V/G) → palette fallback → `adaptFillTintForCanvas` (ADR-509)
 * ώστε να μην επαναλαμβάνεται το «vg ?? fallback → adapt» σε κάθε renderer.
 *
 * Renderers ΧΩΡΙΣ category-tint+single-fallback (Stair per-tread / MEP equipment /
 * Foundation / Roof / …) ΔΕΝ χρειάζονται wrapper — καλούν ΑΠΕΥΘΕΙΑΣ το υπάρχον SSoT
 * `adaptFillTintForCanvas(resolvedFill)` (κανένα περιττό 1:1 indirection — Giorgio
 * SSoT audit 2026-06-22: το προηγούμενο `adaptBimBodyFill` wrapper αφαιρέθηκε).
 *
 * @see ./bim-vg-fill-tint.ts — V/G category color → rgba tint (ADR-375)
 * @see ../../config/adaptive-entity-color.ts — adaptFillTintForCanvas (dark-canvas boost, ADR-509· το adaptive SSoT)
 */
import type { BimCategory, ObjectStyle } from '../../config/bim-object-styles';
import type { CutState } from '../../config/bim-view-range';
import { resolveVgFillTint } from './bim-vg-fill-tint';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';

/**
 * Resolve the final canvas `fillStyle` string for a BIM member's translucent body
 * fill: the V/G category tint (when the user set one) else the renderer's own
 * palette `fallbackFill`, then the shared ADR-509 background-adaptive boost. ONE
 * code path for ALL BIM members → identical translucency on any canvas background.
 *
 * @param fallbackFill the renderer's own per-kind/per-category translucent rgba
 *   (e.g. `KIND_FILL[kind]` / `WALL_CATEGORY_FILL[cat]`), used when no V/G color.
 * @param bgHex optional live canvas background (defaults to the resolved DXF bg).
 */
export function resolveBimBodyFill(
  category: BimCategory,
  cutState: CutState,
  objectStyles: Partial<Record<BimCategory, ObjectStyle>> | undefined,
  fallbackFill: string,
  bgHex?: string,
): string {
  return adaptFillTintForCanvas(resolveVgFillTint(category, cutState, objectStyles) ?? fallbackFill, bgHex);
}
