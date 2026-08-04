/**
 * anchorOffset — THE single answer to «where, relative to the anchor point, do the glyphs
 * START?». The horizontal companion of `text-vertical-metrics.baselineOffsetFromAnchor`
 * («where, relative to the anchor point, does the BASELINE sit?»); the two live side by side
 * because they are the same question on the two axes, and a text block is placed by answering
 * both.
 *
 * Returns a signed offset in the SAME unit as `advance` — the function is a pure linear
 * combination, so it is unit-agnostic and serves all three coordinate frames the viewer uses
 * (screen px, world units, sheet mm). ⚠️ It does NOT convert: a caller holding mm and drawing
 * in px multiplies at ITS OWN boundary, exactly as before.
 *
 * WHY (ADR-753 Φ4): the identical case triad — `right → -advance · center → -advance/2 ·
 * left → 0` — existed FIVE times, in three frames and two type vocabularies:
 * `TextRenderer.paintLayoutLines` (px), `explode-text.explodeTextEntity` (world),
 * `clip-entity.clipText` (world), `glyph-run-draw.drawGlyphRunToCanvas` (px) and
 * `table-text-decoration.tableAnchorOffsetMm` (mm). They agreed when measured, which is the
 * point: five bodies that CAN disagree about where a centred string begins is the «screen ≠
 * file» class the project has already paid for once (ADR-739 Φ.Δ step 8 — four engines, three
 * agreed, the canvas painter did not, and no test saw it because each engine was internally
 * consistent). Token-based clone detection cannot help here: the body is a one-line ternary,
 * far under the 50-token jscpd floor, so reading found it and no gate would have.
 *
 * @module text-engine/fonts/text-horizontal-anchor
 * @see text-engine/fonts/text-vertical-metrics.ts — baselineOffsetFromAnchor (the y-axis sibling)
 */

/**
 * The horizontal anchor of a text run: which side of the anchor point the glyphs extend from.
 *
 * 🔴 DELIBERATELY NARROWER than the DOM's `CanvasTextAlign` (`'start' | 'end' | 'left' |
 * 'right' | 'center'`). Every producer in this codebase already emits exactly these three
 * (`TextRichStyle.textAlign`, `DxfTextStyle.textAlign`, `TextEntity.alignment`, the detail
 * sheet's `TextAlign`); `CanvasTextAlign` only ever appeared as a WIDENING in intermediate
 * signatures, and the five bodies above all silently folded `'end'` onto 0 — i.e. LEFT, while
 * in LTR `'end'` means RIGHT.
 *
 * Keeping the type narrow means that mistake is not expressible: a future producer of `'end'`
 * is stopped by the compiler at the point where someone knows what it should mean, instead of
 * being swallowed in three painters. Resolving `'start'`/`'end'` HERE would be the opposite —
 * a behaviour change nobody asked for, in a direction no test covers because it is currently
 * unreachable. Widen the type only together with that decision.
 */
export type HorizontalTextAnchor = 'left' | 'center' | 'right';

/**
 * Signed offset from the anchor point to the LEFT edge of a run whose pen advance is `advance`,
 * in `advance`'s own unit. Negative for centre/right anchoring, `0` for left.
 *
 * The switch is exhaustive on purpose (no `default`): widening {@link HorizontalTextAnchor}
 * without answering the new case is a compile error, not a silent fold onto left.
 */
export function anchorOffset(anchor: HorizontalTextAnchor, advance: number): number {
  switch (anchor) {
    case 'center':
      return -advance / 2;
    case 'right':
      return 0;
    case 'left':
      return 0;
  }
}

/**
 * A stored entity's `alignment` → the anchor it draws from. Mirrors `MTextEntity['alignment']`,
 * which carries one value {@link HorizontalTextAnchor} deliberately does not.
 *
 * `'justify'` → **left**: fully justified text fills its column starting at the LEFT edge, and
 * that edge is the anchor. `undefined` → left, the DXF default (group 72 absent = left).
 *
 * WHY here and not inline per caller: unlike `'start'`/`'end'` — whose meaning depends on text
 * direction, so the narrowing belongs where the direction is known — `'justify'` has ONE answer
 * for every consumer. It used to be given twice: `clip-entity.clipText` (which decides which
 * characters survive a clip region) and `scene-vector-emitter.mapHAlign` (which places the
 * glyphs in the exported PDF). Those two disagreeing is precisely the «screen ≠ file» class
 * this module exists to close.
 */
export function entityAlignmentToAnchor(
  alignment: 'left' | 'center' | 'right' | 'justify' | undefined,
): HorizontalTextAnchor {
  return alignment === 'center' || alignment === 'right' ? alignment : 'center';
}
