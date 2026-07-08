/**
 * ADR-557 — TEXT/MTEXT flat RENDER-FIELD contract (the anti-drift SSoT).
 *
 * THE single list of flat `DxfText` fields that carry TEXT/MTEXT render/interaction state
 * (everything beyond the shared base id/layer/color/lineweight). EVERY projection that maps
 * a text entity into the render pipeline copies EXACTLY this list:
 *   - `bim/text/project-scene-text.ts` — scene TEXT/MTEXT → flat `DxfText` (grips/ghost/ribbon).
 *   - `hooks/canvas/dxf-text-entity-converter.ts` — scene → `DxfText` (render), delegates to it.
 *   - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `DxfText` → render `EntityModel`.
 *
 * WHY (Giorgio 2026-07-08, «το πρόβλημα επιστρέφει πάντα»): each of those sites used to keep
 * its OWN hand-written field list. Adding a text property (widthFactor, oblique, tracking,
 * lineSpacing…) meant editing 3+ lists; forgetting ONE → the ribbon wrote the value but the
 * renderer never saw it («οι ρυθμίσεις δεν ενημερώνουν το κείμενο»). This module collapses the
 * list into ONE place: add a field here + to `DxfText`, and every projection carries it. The
 * contract test (`text-render-fields.test.ts`) fails if a projection drops a listed field, so
 * the class of bug cannot silently return.
 *
 * Import-time pure: zero React / DOM / THREE / Firestore deps.
 *
 * @module bim/text/text-render-fields
 */

import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';

/**
 * The flat `DxfText` fields that carry TEXT/MTEXT render + interaction state. `position`,
 * `text`, `height` are always present; the rest are optional (copied only when set). Keep in
 * sync with the `DxfText` type — the contract test enforces every projection preserves these.
 */
export const TEXT_RENDER_FIELDS = [
  'position',
  'text',
  'height',
  'rotation',
  'textStyle',
  'width',
  'widthFactor',
  'lineSpacing',
] as const satisfies readonly (keyof DxfText)[];

export type TextRenderField = (typeof TEXT_RENDER_FIELDS)[number];

/**
 * Copy exactly the `TEXT_RENDER_FIELDS` that are present (non-`undefined`) from a source text
 * shape onto a partial `DxfText`. Absent optionals are OMITTED (never written as `undefined`
 * keys → Firestore-safe, and byte-identical to the prior conditional-spread converters). This
 * is THE generic passthrough the `DxfText`→`EntityModel` and scene→`DxfText` projections use
 * instead of hand-enumerating fields.
 */
export function pickTextRenderFields(source: Partial<DxfText>): Partial<DxfText> {
  const out: Record<string, unknown> = {};
  for (const field of TEXT_RENDER_FIELDS) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) out[field] = value;
  }
  return out as Partial<DxfText>;
}
