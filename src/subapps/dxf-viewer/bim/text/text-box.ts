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
 * SSoT REUSE: the 9-point offset table is NOT re-implemented here — we call the
 * existing `offsetForJustification` (`text-engine/layout/attachment-point.ts`,
 * ADR-344 Φ3). That helper is y-DOWN (Canvas2D) and returns the offset from the
 * insertion point to the block's TOP-LEFT corner; we map it to the world y-UP,
 * bbox-centre `RectFrame` the grip engine consumes:
 *
 *   {dx,dy} = offsetForJustification(just, {w,h})   // y-down, → top-left corner
 *   localCenter = { x: dx + w/2, y: -(dy + h/2) }    // → world y-up, box centre
 *   center = position + R(rotationDeg) · localCenter
 *
 * The inverse (`textBoxToPosition`) re-homes `position` from a (resized/rotated)
 * frame using the SAME helper at the new w,h — so a resize keeps the attachment
 * point pinned, exactly like Revit / AutoCAD.
 *
 * Pure: zero React / DOM / Firestore / canvas / THREE deps.
 *
 * @see text-engine/layout/attachment-point.ts — offsetForJustification (9-point SSoT)
 * @see bim/grips/rect-frame.ts — RectFrame + corner world helpers
 * @see bim/text/text-grips.ts — the grip adapter that consumes this box
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfText, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { TextJustification } from '../../text-engine/types/text-ast.types';
import { offsetForJustification } from '../../text-engine/layout';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
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

/** Natural (widthFactor = 1) rendered width of a simple TEXT at a given height. */
function naturalTextWidth(text: string | undefined | null, height: number): number {
  const len = text ? text.length : 0;
  return Math.max(len, 1) * height * CHAR_WIDTH;
}

/** A finite, positive box height (world units) — guards undefined/0/NaN at the source. */
export function resolveBoxHeight(text: DxfText): number {
  return Number.isFinite(text.height) && text.height > 0 ? text.height : DEFAULT_TEXT_HEIGHT;
}

/**
 * Effective box width (world units): the MTEXT frame `width` when carried, else the
 * simple-TEXT `len·height·CHAR_WIDTH·widthFactor`. Robust to a missing flat `text`
 * (content can live in a `textNode` on some scene shapes) — never throws.
 */
export function effectiveTextWidth(text: DxfText): number {
  if (text.width != null && text.width > 0) return text.width;
  return naturalTextWidth(text.text, resolveBoxHeight(text)) * (text.widthFactor ?? 1);
}

/** Re-export so a resize can recompute width from a patched height (TEXT widthFactor path). */
export { naturalTextWidth };

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
 * Local (un-rotated, world y-up) offset from `position` to the box CENTRE, derived
 * from the existing y-down `offsetForJustification` SSoT (see module header).
 */
function localCenterOffset(just: TextJustification, w: number, h: number): Point2D {
  const { dx, dy } = offsetForJustification(just, { x: 0, y: 0, width: w, height: h });
  return { x: dx + w / 2, y: -(dy + h / 2) };
}

/**
 * `DxfText` → attachment-aware bbox-centre `RectFrame` (world units). The box is
 * pinned so its attachment point sits on `entity.position`; it rotates around that
 * point by `rotation` (AutoCAD TEXT rotates about its insertion point).
 */
export function resolveTextBox(text: DxfText): RectFrame {
  const w = effectiveTextWidth(text);
  const h = resolveBoxHeight(text);
  const rotationDeg = text.rotation ?? 0;
  const rel = rotateVector(localCenterOffset(justificationOf(text), w, h), rotationDeg);
  return {
    center: translatePoint(text.position, rel),
    rotationDeg,
    halfWidth: w / 2,
    halfLength: h / 2,
  };
}

/**
 * Inverse of `resolveTextBox`'s centre derivation: a (possibly resized/rotated)
 * `RectFrame` → the LOWER-LEVEL `position` (attachment point), using the SAME
 * justification + `offsetForJustification` SSoT at the frame's current dimensions.
 */
export function textBoxToPosition(frame: RectFrame, text: DxfText): Point2D {
  const rel = rotateVector(
    localCenterOffset(justificationOf(text), frame.halfWidth * 2, frame.halfLength * 2),
    frame.rotationDeg,
  );
  return { x: frame.center.x - rel.x, y: frame.center.y - rel.y };
}

/** The four box corners in world coords (rotation-aware) — NE, NW, SW, SE. */
export function textBoxCornersWorld(text: DxfText): Point2D[] {
  const frame = resolveTextBox(text);
  return RECT_CORNERS.map((c) => rectCornerWorld(frame, c));
}

/** Axis-aligned world bounding box enclosing the (rotated) attachment-aware text box. */
export function textBoxAABB(text: DxfText): TextBoxAABB {
  const corners = textBoxCornersWorld(text);
  let minX = corners[0].x, minY = corners[0].y, maxX = corners[0].x, maxY = corners[0].y;
  for (let i = 1; i < corners.length; i++) {
    const c = corners[i];
    if (c.x < minX) minX = c.x; else if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y; else if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}
