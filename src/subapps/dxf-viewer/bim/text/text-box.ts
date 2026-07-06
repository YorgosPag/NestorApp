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
  };
}

/** A finite, positive box height (world units) — guards undefined/0/NaN at the source. */
export function resolveBoxHeight(text: DxfText): number {
  return Number.isFinite(text.height) && text.height > 0 ? text.height : DEFAULT_TEXT_HEIGHT;
}

/**
 * Effective box width (world units): the MTEXT frame `width` when carried, else the
 * simple-TEXT REAL glyph advance (`measureTextAdvanceWorld` — proportional font
 * metrics, incl. the AutoCAD X-scale `widthFactor`), so the box === the drawn glyphs.
 * Falls back to a monospace approximation only when no font + no DOM are available
 * (jest / SSR / font not yet loaded). Robust to a missing flat `text` — never throws.
 */
export function effectiveTextWidth(text: DxfText): number {
  if (text.width != null && text.width > 0) return text.width;
  return measureTextAdvanceWorld(text.text ?? '', resolveBoxHeight(text), advanceStyleOf(text));
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
  return measureTextAdvanceWorld(text.text ?? '', height, { ...advanceStyleOf(text), widthFactor: 1 });
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
 * NOMINAL em-box vertical ratios — the pre-metrics behaviour, the `offsetForJustification`
 * y-part as ratios (row T → [0,-1], M → [0.5,-0.5], B → [1,0]). Drives the "edit"/3D box
 * (`resolveTextEmBox`) + is the safe fallback when glyph metrics are unavailable.
 */
function emVerticalRatios(just: TextJustification): VBoxRatios {
  const row = just[0];
  const center = row === 'M' ? 0 : row === 'B' ? 0.5 : -0.5;
  return { top: center + 0.5, bottom: center - 0.5 };
}

/** The glyph ink box (font metrics + ink extent + side bearings), measured once per box build. */
function glyphInkOf(text: DxfText): TextGlyphInk {
  return measureTextGlyphInk(text.text ?? '', advanceStyleOf(text));
}

/**
 * VISUAL vertical ratios from a measured glyph ink box — the box hugs the drawn glyphs:
 * baseline where the renderer seats it (font ascent/descent per the attachment row,
 * mirroring `TextRenderer.fillGlyphRun`) + extent = real glyph INK (cap height for caps,
 * +descenders for g/p/y). Degrades to the nominal em box when the ink is unavailable
 * (SSR / no font) — keeping the pre-metrics behaviour + jest stable.
 */
function visualVerticalRatios(ink: TextGlyphInk, just: TextJustification): VBoxRatios {
  const row = just[0];
  const baselineDrop = row === 'M' ? (ink.fontAscent - ink.fontDescent) / 2 : row === 'B' ? -ink.fontDescent : ink.fontAscent;
  const baselineUp = -baselineDrop; // world y-up offset from `position` down to the baseline
  const top = baselineUp + ink.inkAscent;
  const bottom = baselineUp - ink.inkDescent;
  return top - bottom > 1e-9 ? { top, bottom } : emVerticalRatios(just);
}

/**
 * Horizontal ink insets as fractions of the pen advance (leading + trailing side bearing),
 * so the visual box hugs the glyphs left+right too (Giorgio 2026-07-07: «επεκτείνεται προς
 * τα έξω»). ZERO for MTEXT (its width is the explicit frame, not the glyph advance) and for
 * the no-font path (`advance === 0`) — the box then keeps the full advance width. Guaranteed
 * `left + right < 1` (ink is a sub-span of the advance), so the visual width stays positive.
 */
function horizontalInkFractions(text: DxfText, ink: TextGlyphInk): { left: number; right: number } {
  if (text.width != null && text.width > 0) return { left: 0, right: 0 };
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

  if (mode === 'em') {
    const v = emVerticalRatios(just);
    const rel = rotateVector({ x: advanceCentreX, y: ((v.top + v.bottom) / 2) * h }, rotationDeg);
    return { center: translatePoint(text.position, rel), rotationDeg, halfWidth: w / 2, halfLength: ((v.top - v.bottom) / 2) * h };
  }

  const ink = glyphInkOf(text);
  const v = visualVerticalRatios(ink, just);
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
  const v = visualVerticalRatios(ink, just);
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
  const { top, bottom } = visualVerticalRatios(glyphInkOf(text), justificationOf(text));
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
