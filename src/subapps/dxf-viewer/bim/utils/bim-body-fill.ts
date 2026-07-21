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
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';

/**
 * Translucent ORANGE poché for an armed-selected BIM body (GRIP_ARMED_COLOR #FF6A00 @ 45%).
 * Giorgio 2026-07-21 — a transform tool (Move/Copy/Rotate/Mirror) is armed with a selection
 * before the base point is picked, so the selected BIM members read ORANGE just like the DXF
 * entities do (which get it via PhaseManager). Kept translucent so geometry stays legible.
 */
export const BIM_ARMED_BODY_FILL = 'rgba(255, 106, 0, 0.45)';

/**
 * True when a transform tool is armed (base point not yet picked) on THIS selected entity.
 * SSoT predicate shared by every BIM renderer so the armed-orange rule cannot drift (N.18).
 * Structural param (not RenderOptions) to avoid a rendering-types import in this bim util.
 */
export function isArmedSelectedHighlight(options: {
  selected?: boolean;
  armedTransformHighlight?: boolean;
}): boolean {
  return !!options.selected && !!options.armedTransformHighlight;
}

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
  armedHighlight?: boolean,
): string {
  // Armed-transform selection wins over the V/G tint + palette — the whole body reads ORANGE
  // (Giorgio 2026-07-21). One branch here → every BIM renderer inherits it via the shared SSoT.
  if (armedHighlight) return BIM_ARMED_BODY_FILL;
  return adaptFillTintForCanvas(resolveVgFillTint(category, cutState, objectStyles) ?? fallbackFill, bgHex);
}

/**
 * 🎨 BACKGROUND + FOREGROUND PATTERN (Revit / ArchiCAD cut-fill model).
 *
 * Fills the CURRENT canvas path twice — the caller builds the path, this owns
 * the paint. Revit's cut fill is not one layer but two: an **opaque background
 * pattern** in the sheet colour that occludes whatever sits beneath the member,
 * plus a **foreground pattern** (the translucent poché tint + hatch) that
 * carries the category/material identity. This project only ever had the
 * foreground, which is why drawing aids beneath a body (the F7 grid) read
 * straight through the wall.
 *
 * Because the base is painted in the LIVE canvas background colour, the
 * composited result over empty canvas is pixel-identical to the previous
 * single-fill look — only content *underneath* the body is now occluded, which
 * is precisely the Revit/ArchiCAD behaviour (a wall hides linked CAD beneath it).
 *
 * ONE owner for wall/column/slab so the two-pass order can never drift apart
 * across renderers (CLAUDE.md N.18 — no sibling clones).
 *
 * `beyond` members are the one exception: they sit outside the view range and
 * are drawn as a faint "there is something over there" hint, so they must NOT
 * occlude — same rule Revit applies to beyond-range geometry. `cut` and
 * `projection` both occlude (a slab below the cut plane hides what is under it).
 *
 * @param resolvedFill final foreground `fillStyle` — the caller resolves it
 *   (top-face override, V/G tint, palette fallback) via {@link resolveBimBodyFill}.
 * @param cutState the member's display state; `beyond` skips the opaque base.
 * @param bgHex optional live canvas background (defaults to the resolved DXF bg).
 */
export function fillBimBodyPath(
  ctx: CanvasRenderingContext2D,
  resolvedFill: string,
  cutState?: CutState,
  bgHex?: string,
): void {
  const previousFill = ctx.fillStyle;
  if (cutState !== 'beyond') {
    ctx.fillStyle = bgHex ?? resolveDxfCanvasBackgroundHex();
    ctx.fill();
  }
  ctx.fillStyle = resolvedFill;
  ctx.fill();
  ctx.fillStyle = previousFill;
}
