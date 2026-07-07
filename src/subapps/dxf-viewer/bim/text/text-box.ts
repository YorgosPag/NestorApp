/**
 * ADR-557 (Φ-attachment) — Attachment-aware TEXT/MTEXT box geometry SSoT.
 *
 * THE single source for "where does a text's box live in the world". Every consumer
 * reads it: 2D grips (`text-grips.ts`), the 2D hover/selection frame + hitTest
 * (`TextRenderer`), the 3D textured-plane anchor (`dxf-text-3d.ts`), the 3D hover
 * outline (`dxf-entity-outline.ts`), and culling / bounds (`getEntityBBox`). Before
 * this module each of those re-derived the box with its OWN hard-coded convention
 * (grips+3D = baseline-left; hitTest = top-left; bbox = symmetric ±h) — all of them
 * IGNORING the text's `attachment`, so the box, the glyphs and the handles never
 * coincided and 2D ≠ 3D (Giorgio 2026-06-30).
 *
 * KEY INSIGHT: `position` is the entity's *attachment point* (the 9-point grid
 * TL/TC/.../BR, MTEXT group code 71), NOT always lower-left. The 2D renderer already
 * honours it via `textStyle.textAlign` (L/C/R) + `textStyle.textBaseline` (T/M/B),
 * derived from `attachment` by `extractFirstRunStyle`. This module reconstructs the
 * justification from those two style fields and offsets the box accordingly, so the
 * box lands EXACTLY where the renderer paints the glyphs.
 *
 * HORIZONTAL: the 9-point column (L/C/R) offset comes from `offsetForJustification`
 * (`text-engine/layout/attachment-point.ts`, ADR-344 Φ3) via `horizontalCenterOffset`, on
 * the real glyph advance (`measureTextAdvanceWorld`). The VISUAL box then insets that by the
 * glyph SIDE BEARINGS (`horizontalInkFractions`) so it hugs the letters left+right too.
 *
 * The box hugs the DRAWN glyphs on ALL four sides via ONE measured glyph ink box
 * (`measureTextGlyphInk`: font metrics + ink extent + side bearings). There are TWO boxes
 * (the "visual bounds vs edit box" split real editors use):
 *   - `resolveTextBox` (VISUAL) — baseline seated by the FONT metrics (per the attachment
 *     row) + vertical extent = glyph INK (cap height / +descenders) + horizontal inset by the
 *     side bearings. The 2D grip / hover / hitTest box, so handles + outline coincide with the
 *     letters on all sides (Giorgio 2026-07-07: κάθετα + οριζόντια).
 *   - `resolveTextEmBox` (NOMINAL) — the pre-metrics em box (`emVerticalRatios` + full
 *     advance), used by the em-based 3D textured plane + culling, which must NOT follow it.
 *
 *   center = position + R(rotationDeg) · { horizontalCenterOffset, verticalCentre·h }
 *
 * The inverse (`textBoxToPosition`) re-homes `position` from a (resized/rotated) VISUAL
 * frame with the SAME ratios — so a resize keeps the attachment point pinned (Revit /
 * AutoCAD). The resize divides the dragged box height by `textVisualExtentRatio` to
 * recover the nominal `height` (see `text-grips.ts` `framePatch`).
 *
 * Import-time pure: zero React / Firestore / THREE deps. The width now measures the
 * real glyph advance (`measureTextAdvanceWorld`); its only DOM touch (the CSS-fallback
 * `measureText`) is lazy + `typeof document`-guarded inside that helper, so this module
 * still loads and runs in jest / SSR (where it degrades to the monospace approximation).
 *
 * @see text-engine/fonts/text-advance.ts — measureTextAdvanceWorld (width metrics SSoT)
 * @see text-engine/fonts/text-vertical-metrics.ts — measureTextGlyphInk (glyph ink box SSoT)
 * @see text-engine/layout/attachment-point.ts — offsetForJustification (9-point SSoT)
 * @see bim/grips/rect-frame.ts — RectFrame + corner world helpers
 * @see bim/text/text-grips.ts — the grip adapter that consumes this box
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfText, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { TextJustification } from '../../text-engine/types/text-ast.types';
import { offsetForJustification } from '../../text-engine/layout';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
// ADR-557 Φ-attachment — metrics-accurate width: the box measures with the SAME real
// glyph advance the renderer paints (`getGlyphRun` / CSS `measureText`), not a monospace
// approximation, so grips / hover / hitTest coincide with the drawn glyphs.
import { measureTextAdvanceWorld, measureTextGlyphInk, type TextAdvanceStyle, type TextGlyphInk } from '../../text-engine/fonts';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateVector } from '../grips/grip-math';
import { RECT_CORNERS, rectCornerWorld, type RectFrame } from '../grips/rect-frame';
// ADR-557 (multi-line) — the shared split + line-stacking SSoT: box height = Σ γραμμών,
// width = max γραμμής. The SAME helper the renderer + 3D use, so the three stay in parity.
import { splitTextLines, textLineCount, resolveLineSpacingRatio, resolveMultilineExtents, type TextRow, type MultilineExtents } from './text-lines';

const CHAR_WIDTH = TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

/** Fallback height (world units) when a text carries no usable height (AutoCAD DIMTXT default). */
const DEFAULT_TEXT_HEIGHT = 2.5;

/** Axis-aligned bounding box in world units (matches `getEntityBBox`'s shape). */
export interface TextBoxAABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Monospace fallback width (widthFactor = 1) of a simple TEXT at a given height —
 * retained for the resize inverse's deterministic base and no-font/SSR paths. The
 * live box now sizes with the real glyph advance via `measureTextAdvanceWorld`.
 */
function naturalTextWidth(text: string | undefined | null, height: number): number {
  const len = text ? text.length : 0;
  return Math.max(len, 1) * height * CHAR_WIDTH;
}

/** Font/X-scale inputs for the metrics-accurate advance, read off the flat `DxfText`. */
function advanceStyleOf(text: DxfText): TextAdvanceStyle {
  const style = text.textStyle;
  return {
    fontFamily: style?.fontFamily,
    bold: style?.bold,
    italic: style?.italic,
    widthFactor: text.widthFactor ?? 1,
    // AutoCAD `\T` tracking so the grip/hover box hugs the tracked glyphs (ADR-557 parity).
    tracking: style?.tracking ?? 1,
  };
}

/** A finite, positive box height (world units) — guards undefined/0/NaN at the source. */
export function resolveBoxHeight(text: DxfText): number {
  return Number.isFinite(text.height) && text.height > 0 ? text.height : DEFAULT_TEXT_HEIGHT;
}

/**
 * ADR-557 (multi-line) — the WIDEST visual line of a text (by real glyph advance). The
 * multi-line box width = max line, and its horizontal ink insets must come from that SAME
 * line, so width + side-bearings agree. Single-line → the sole line (zero regression).
 */
function widestLineOf(text: DxfText): string {
  const lines = splitTextLines(text.text);
  if (lines.length <= 1) return lines[0] ?? '';
  const h = resolveBoxHeight(text);
  const style = advanceStyleOf(text);
  let best = lines[0] ?? '';
  let bestW = -1;
  for (const line of lines) {
    const w = measureTextAdvanceWorld(line, h, style);
    if (w > bestW) { bestW = w; best = line; }
  }
  return best;
}

/** The REAL glyph advance (world) of the WIDEST line — the box's content width when it hugs. */
function contentAdvanceWorld(text: DxfText): number {
  return measureTextAdvanceWorld(widestLineOf(text), resolveBoxHeight(text), advanceStyleOf(text));
}

/**
 * ADR-557 (multi-line, Giorgio 2026-07-07: «οι λαβές να αγκαλιάζουν το κείμενο») — is the box
 * constrained by an EXPLICIT MTEXT frame narrower than the text (i.e. the text would wrap /
 * overflow to fit the column)? Only THEN does the frame win. When the frame is WIDER than every
 * line (no wrap — the reported case, an editor-overlay-sized frame), the box hugs the glyphs
 * like a simple TEXT. `false` for simple TEXT (no frame) and for a frame ≥ the content.
 */
export function isTextBoxFrameConstrained(text: DxfText): boolean {
  return text.width != null && text.width > 0 && text.width < contentAdvanceWorld(text);
}

/**
 * Effective box width (world units): the WIDEST-line glyph advance (`measureTextAdvanceWorld`
 * — proportional metrics, incl. the AutoCAD X-scale `widthFactor`), CLAMPED to an explicit
 * MTEXT frame `width` when that frame is narrower (text wraps/clips to the column). So the box
 * HUGS the drawn glyphs whenever the text does not fill the frame (Giorgio 2026-07-07), and only
 * falls back to the column frame under genuine wrap. Falls back to a monospace approximation when
 * no font + no DOM are available (jest / SSR). Robust to a missing flat `text` — never throws.
 */
export function effectiveTextWidth(text: DxfText): number {
  const content = contentAdvanceWorld(text);
  return text.width != null && text.width > 0 ? Math.min(text.width, content) : content;
}

/** Re-export so a resize can recompute width from a patched height (TEXT widthFactor path). */
export { naturalTextWidth };

/**
 * The REAL glyph advance at `widthFactor = 1` (world units) — the base a TEXT resize
 * divides the new box width by to derive the new `widthFactor`. Uses the SAME metrics
 * as `effectiveTextWidth`, so `effectiveTextWidth(after-resize) === newWidth` (no jump
 * on release). Matches the monospace `naturalTextWidth` only in the no-font fallback.
 */
export function baseTextAdvanceWorld(text: DxfText, height: number): number {
  return measureTextAdvanceWorld(widestLineOf(text), height, { ...advanceStyleOf(text), widthFactor: 1 });
}

/**
 * Resolve the 9-point justification of a text. Sources, in priority order:
 *   1. `textNode.attachment` — the canonical 9-point code carried by the SCENE
 *      entity (TextEntity/MTextEntity, MTEXT group 71). This is what the live ghost
 *      + commit see, so the dragged box matches the rendered glyphs.
 *   2. `textStyle.textAlign/textBaseline` — the renderer's derived style fields on
 *      the flat `DxfText` (render + interaction-grip path). We invert that mapping.
 *   3. Default `TL` (the renderer's default baseline = 'top', align = 'left').
 */
function justificationOf(text: DxfText): TextJustification {
  const att = (text as { textNode?: { attachment?: TextJustification } }).textNode?.attachment;
  if (att) return att;
  const style: DxfTextStyle | undefined = text.textStyle;
  const col = style?.textAlign === 'center' ? 'C' : style?.textAlign === 'right' ? 'R' : 'L';
  const row = style?.textBaseline === 'middle' ? 'M' : style?.textBaseline === 'bottom' ? 'B' : 'T';
  return `${row}${col}` as TextJustification;
}

/**
 * Horizontal (x) offset from `position` to the box CENTRE — the column (L/C/R) part
 * of the 9-point `offsetForJustification` SSoT. `dx` depends only on the column +
 * width (not the height), so the vertical extent is free to come from real glyph
 * metrics (`visualVerticalRatios`) while x still honours the attachment column.
 */
function horizontalCenterOffset(just: TextJustification, w: number): number {
  const { dx } = offsetForJustification(just, { x: 0, y: 0, width: w, height: 0 });
  return dx + w / 2;
}

/** Box top/bottom edges as height-INDEPENDENT ratios of the em height (world y-up, from `position`). */
interface VBoxRatios {
  readonly top: number;
  readonly bottom: number;
}

/**
 * ADR-557 (multi-line) — the extra vertical extent of the text block beyond one line,
 * split by attachment row so `position` stays the anchor (T grows down, B up, M both).
 * Single line → both zero. Shared by the em + visual ratios AND the renderer's first-line
 * offset (`text-lines.ts`), so render ≡ box for every attachment + line count.
 */
function multilineExtentsOf(text: DxfText, just: TextJustification): MultilineExtents {
  return resolveMultilineExtents(just[0] as TextRow, textLineCount(text.text), resolveLineSpacingRatio(text));
}

/**
 * NOMINAL em-box vertical ratios — the pre-metrics behaviour, the `offsetForJustification`
 * y-part as ratios (row T → [0,-1], M → [0.5,-0.5], B → [1,0]), extended DOWN/UP by the
 * multi-line block. Drives the "edit"/3D box (`resolveTextEmBox`) + is the safe fallback
 * when glyph metrics are unavailable.
 */
function emVerticalRatios(just: TextJustification, extents: MultilineExtents): VBoxRatios {
  const row = just[0];
  const center = row === 'M' ? 0 : row === 'B' ? 0.5 : -0.5;
  return { top: center + 0.5 + extents.topAdd, bottom: center - 0.5 - extents.bottomAdd };
}

/** The glyph ink box (font metrics + ink extent + side bearings) of the WIDEST line. */
function glyphInkOf(text: DxfText): TextGlyphInk {
  return measureTextGlyphInk(widestLineOf(text), advanceStyleOf(text));
}

/**
 * ADR-557 — the box SHEAR (`tan θ`) for the AutoCAD oblique angle, so the grip/hover box
 * is a PARALLELOGRAM that leans with the sheared glyphs. Local +Y = up (cap top), local +X
 * = advance (reading-right): a positive oblique shifts the top RIGHT (forward «/»), matching
 * the renderer's `ctx.transform(1,0,-tanθ,1,0,0)` in the y-DOWN screen frame. 🔴 browser-verify
 * the lean matches the glyphs; flip the sign if the box leans opposite the text.
 */
function obliqueShearOf(text: DxfText): number {
  const angle = text.textStyle?.obliqueAngle;
  return typeof angle === 'number' && angle !== 0 ? Math.tan((angle * Math.PI) / 180) : 0;
}

/**
 * VISUAL vertical ratios from a measured glyph ink box — the box hugs the drawn glyphs:
 * baseline where the renderer seats it (font ascent/descent per the attachment row,
 * mirroring `TextRenderer.fillGlyphRun`) + extent = real glyph INK (cap height for caps,
 * +descenders for g/p/y), then extended by the multi-line block (`extents`). Degrades to the
 * nominal em box when the ink is unavailable (SSR / no font) — keeping jest stable.
 */
function visualVerticalRatios(ink: TextGlyphInk, just: TextJustification, extents: MultilineExtents): VBoxRatios {
  const row = just[0];
  const baselineDrop = row === 'M' ? (ink.fontAscent - ink.fontDescent) / 2 : row === 'B' ? -ink.fontDescent : ink.fontAscent;
  const baselineUp = -baselineDrop; // world y-up offset from `position` down to the baseline
  const top = baselineUp + ink.inkAscent + extents.topAdd;
  const bottom = baselineUp - ink.inkDescent - extents.bottomAdd;
  return top - bottom > 1e-9 ? { top, bottom } : emVerticalRatios(just, extents);
}

/**
 * Horizontal ink insets as fractions of the pen advance (leading + trailing side bearing),
 * so the visual box hugs the glyphs left+right too (Giorgio 2026-07-07: «επεκτείνεται προς
 * τα έξω»). ZERO for a frame-constrained MTEXT (width = the explicit column frame, not the
 * glyph advance) and for the no-font path (`advance === 0`) — the box then keeps the full
 * advance width; a WIDE-frame MTEXT hugs the glyphs like a simple TEXT. Guaranteed
 * `left + right < 1` (ink is a sub-span of the advance), so the visual width stays positive.
 */
function horizontalInkFractions(text: DxfText, ink: TextGlyphInk): { left: number; right: number } {
  // Frame-constrained MTEXT (text wraps to the column) → the width is the explicit frame, no inset.
  // A hugging box (simple TEXT or a frame WIDER than the text) insets by the real side bearings.
  if (isTextBoxFrameConstrained(text)) return { left: 0, right: 0 };
  if (!(ink.advance > 0)) return { left: 0, right: 0 };
  return { left: ink.inkLeft / ink.advance, right: (ink.advance - ink.inkRight) / ink.advance };
}

/**
 * `DxfText` → attachment-aware bbox-centre `RectFrame` (world units). The box is pinned
 * so its attachment point sits on `entity.position` and rotates about it (AutoCAD TEXT
 * rotates about its insertion point). `mode` picks the vertical extent: the VISUAL glyph
 * ink box (2D interaction) or the NOMINAL em box (3D plane + culling).
 */
function buildTextBox(text: DxfText, mode: 'visual' | 'em'): RectFrame {
  const w = effectiveTextWidth(text); // pen advance (world, incl. widthFactor) — or MTEXT frame width
  const h = resolveBoxHeight(text);
  const just = justificationOf(text);
  const rotationDeg = text.rotation ?? 0;
  const advanceCentreX = horizontalCenterOffset(just, w);
  const extents = multilineExtentsOf(text, just);
  // ADR-557 — parallelogram shear for the oblique angle (0 → plain rect, zero regression).
  const shearX = obliqueShearOf(text);

  if (mode === 'em') {
    const v = emVerticalRatios(just, extents);
    const rel = rotateVector({ x: advanceCentreX, y: ((v.top + v.bottom) / 2) * h }, rotationDeg);
    return { center: translatePoint(text.position, rel), rotationDeg, halfWidth: w / 2, halfLength: ((v.top - v.bottom) / 2) * h, ...(shearX !== 0 && { shearX }) };
  }

  const ink = glyphInkOf(text);
  const v = visualVerticalRatios(ink, just, extents);
  const { left, right } = horizontalInkFractions(text, ink);
  // Inset the advance box by the side bearings: shift the centre toward the wider bearing,
  // shrink the width by the total inset (`left`/`right` are fractions of the advance `w`).
  const rel = rotateVector(
    { x: advanceCentreX + (w * (left - right)) / 2, y: ((v.top + v.bottom) / 2) * h },
    rotationDeg,
  );
  return {
    center: translatePoint(text.position, rel),
    rotationDeg,
    halfWidth: (w * (1 - left - right)) / 2,
    halfLength: ((v.top - v.bottom) / 2) * h,
    ...(shearX !== 0 && { shearX }),
  };
}

/**
 * The VISUAL glyph box — hugs the drawn glyphs (cap height / real ink extent). THE box
 * for 2D grips, the 2D hover/selection frame and hitTest, so handles + outline coincide
 * with the letters (ADR-557 Φ-attachment vertical, Giorgio 2026-07-07).
 */
export function resolveTextBox(text: DxfText): RectFrame {
  return buildTextBox(text, 'visual');
}

/**
 * The NOMINAL em box — the pre-metrics geometry (em height, attachment-anchored). Used by
 * the 3D textured-plane anchor (`dxf-text-3d.ts`) and viewport culling, which are em-based
 * (the 3D canvas draws the glyph centred in an em cell) and must NOT follow the cap box.
 */
export function resolveTextEmBox(text: DxfText): RectFrame {
  return buildTextBox(text, 'em');
}

/**
 * Inverse of the VISUAL box's centre derivation: a (resized/rotated) `RectFrame` → the
 * `position` (attachment point). Re-homes the anchor with the SAME justification + visual
 * vertical ratios, so a resize keeps the attachment point pinned (Revit / AutoCAD).
 */
export function textBoxToPosition(frame: RectFrame, text: DxfText): Point2D {
  const just = justificationOf(text);
  const ink = glyphInkOf(text);
  const v = visualVerticalRatios(ink, just, multilineExtentsOf(text, just));
  const { left, right } = horizontalInkFractions(text, ink);
  // Recover the advance width from the visual half-width (visualWidth = w·(1−left−right)),
  // then reproduce the SAME inset centre offset the forward build applied.
  const w = (frame.halfWidth * 2) / (1 - left - right);
  const relX = horizontalCenterOffset(just, w) + (w * (left - right)) / 2;
  const relY = frame.halfLength * ((v.top + v.bottom) / (v.top - v.bottom));
  const rel = rotateVector({ x: relX, y: relY }, frame.rotationDeg);
  return { x: frame.center.x - rel.x, y: frame.center.y - rel.y };
}

/**
 * The VISUAL box's vertical extent ÷ em height (= inkAscent + inkDescent) — the divisor a
 * resize uses to recover the nominal `height` from a dragged box height, so the box holds
 * after release (`resolveTextBox(after) === draggedFrame`, no jump). Em-box path → 1.0.
 */
export function textVisualExtentRatio(text: DxfText): number {
  const just = justificationOf(text);
  const { top, bottom } = visualVerticalRatios(glyphInkOf(text), just, multilineExtentsOf(text, just));
  return top - bottom;
}

/**
 * The fraction of the pen advance the VISUAL box occupies (1 − side bearings) — the resize
 * divides the dragged box width by this (× the base advance) to recover `widthFactor`, so
 * the box holds after release. MTEXT (explicit width) / no-font → 1.0.
 */
export function textVisualWidthRatio(text: DxfText): number {
  const { left, right } = horizontalInkFractions(text, glyphInkOf(text));
  return 1 - left - right;
}

/** The four VISUAL box corners in world coords (rotation-aware) — NE, NW, SW, SE (2D hover frame). */
export function textBoxCornersWorld(text: DxfText): Point2D[] {
  const frame = resolveTextBox(text);
  return RECT_CORNERS.map((c) => rectCornerWorld(frame, c));
}

/** The four NOMINAL em-box corners (3D hover glow — matches the em-based 3D textured plane). */
export function textEmBoxCornersWorld(text: DxfText): Point2D[] {
  const frame = resolveTextEmBox(text);
  return RECT_CORNERS.map((c) => rectCornerWorld(frame, c));
}

/**
 * Axis-aligned world bounding box enclosing the (rotated) NOMINAL em box — culling uses the
 * generous em box (not the tight cap box) so text never pops at the viewport edge.
 */
export function textBoxAABB(text: DxfText): TextBoxAABB {
  const corners = textEmBoxCornersWorld(text);
  let minX = corners[0].x, minY = corners[0].y, maxX = corners[0].x, maxY = corners[0].y;
  for (let i = 1; i < corners.length; i++) {
    const c = corners[i];
    if (c.x < minX) minX = c.x; else if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y; else if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}
