/**
 * ADR-557 — Text / MText ⇄ RectFrame adapter (FULL rectangular-box grip parity).
 *
 * Bridges a flat `DxfText` (TEXT, or MTEXT normalised to 'text' by the
 * scene→DxfText converter) to the shared `rect-grip-engine` / `rect-frame` SSoT so
 * its 8 resize handles + centre-move + rotation are the SAME code the wall and the
 * rectangular column use — Giorgio 2026-06-30: «τον ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα στα
 * κείμενα, μία πηγή αλήθειας». Mirrors `bim/columns/column-rect-adapter.ts`.
 *
 * GEOMETRY: `position` is the un-rotated LOWER-LEFT (baseline-left) anchor; the box
 * extends +x (right) and +y (UP). This matches the app's real text placement — the
 * 3D text mesh seats its lower-left at `position` (`dxf-text-3d.ts`: centre =
 * `position + (w/2, +h/2)`) and the 2D renderer + `getEntityBBox` use the same
 * lower-left corner. (NOT the `entity-bounds.ts` top-left convention the original
 * plan cited — that put the grip box BELOW the glyphs.) The visual centre =
 * `position + R(θ)·(w/2, +h/2)`. We work on that bbox-centre `RectFrame` and re-home
 * `position` on every transform so the pivot is the box centre (Figma-like).
 *
 * WIDTH SEMANTICS (audit §4.2 / decision #3):
 *   - MTEXT → the real box `width` (carried on `DxfText.width`). Discriminator:
 *     `width != null` ⇒ MTEXT; the e/w resize patches `width` directly.
 *   - TEXT  → no `width`; the box width = `len·height·CHAR_WIDTH·widthFactor`
 *     (AutoCAD X-scale). The e/w resize patches `widthFactor` so the box matches.
 *
 * Pure: zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/rect-grip-engine.ts — shared corner/edge resize SSoT
 * @see bim/columns/column-rect-adapter.ts — the rect-column adapter this mirrors
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, TextGripKind } from '../../hooks/useGripMovement';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { rotateVector } from '../grips/grip-math';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  resolveTextBox,
  textBoxToPosition,
  effectiveTextWidth,
  baseTextAdvanceWorld,
  textVisualExtentRatio,
} from './text-box';
import { rotationHandleMidwayOffset } from '../grips/rotation-handle-policy';
import {
  rectCornerWorld,
  rectEdgeWorld,
  rectLocalWorld,
  type RectFrame,
  type RectCorner,
  type RectEdge,
} from '../grips/rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../grips/rect-grip-engine';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Minimum box dimension (world units) — the engine clamp floor so a resize can
 * never collapse or invert the text box. Tunable knob; small enough never to fight
 * a real drag, large enough to keep a positive `widthFactor` denominator.
 */
export const MIN_TEXT_DIMENSION_WORLD = 0.1;

/** Patch of the top-level text fields a grip drag mutates (preview ≡ commit). */
export interface TextTransformPatch {
  position?: Point2D;
  rotation?: number;
  height?: number;
  /** MTEXT box width (world units). */
  width?: number;
  /** Simple-TEXT X-scale (horizontal stretch factor). */
  widthFactor?: number;
}

/** Inputs shared by every text grip transform. `delta` = world drag since start. */
export interface TextGripDragInput {
  entity: DxfText;
  delta: Point2D;
  /** Current cursor world position (rotation sweep). Falls back to position+delta. */
  currentPos?: Point2D;
  /** Shift → constrain a corner drag to its dominant axis / snap rotation to 45°. */
  ortho?: boolean;
  /** Rotation pivot override (default = the bbox-centre). */
  pivot?: Point2D;
}

/** `width != null` ⇒ the box came from an MTEXT frame (patch `width`, not `widthFactor`). */
function isMTextBox(entity: DxfText): boolean {
  return entity.width != null;
}

/**
 * The attachment-aware text-box geometry lives in the `text-box.ts` SSoT
 * (`resolveTextBox` / `textBoxToPosition` — they honour `textStyle.textAlign/
 * textBaseline`, ADR-557 Φ-attachment). Re-exported here so existing callers + tests
 * keep importing `textToRectFrame` / `effectiveTextWidth` from `text-grips`.
 */
export { effectiveTextWidth };
export { resolveTextBox as textToRectFrame };

function textResizeLimits(): RectResizeLimits {
  const half = MIN_TEXT_DIMENSION_WORLD / 2;
  return { minHalfWidth: half, minHalfLength: half };
}

/** `text-corner-*` → engine local-axis signs. */
const CORNER_MAP: Partial<Record<TextGripKind, RectCorner>> = {
  'text-corner-ne': { sx: 1, sy: 1 },
  'text-corner-nw': { sx: -1, sy: 1 },
  'text-corner-sw': { sx: -1, sy: -1 },
  'text-corner-se': { sx: 1, sy: -1 },
};

/** `text-edge-*` → engine edge axis + face. e/w = width (local X), n/s = height (local Y). */
const EDGE_MAP: Partial<Record<TextGripKind, RectEdge>> = {
  'text-edge-e': { axis: 'x', sign: 1 },
  'text-edge-w': { axis: 'x', sign: -1 },
  'text-edge-n': { axis: 'y', sign: 1 },
  'text-edge-s': { axis: 'y', sign: -1 },
};

/**
 * The 10 grips for a text box (mirror `rectColumnGrips`): centre MOVE (0) +
 * rotation (1) + 4 edge-midpoints (2,3,8,9) + 4 corners (4..7). Positions read via
 * the shared `rect-frame` world helpers; the rotation handle sits midway between
 * centre and bottom edge (`rotationHandleMidwayOffset`, same policy as the column).
 */
export function getTextGrips(entity: DxfText): GripInfo[] {
  const frame = resolveTextBox(entity);
  const { id } = entity;
  const rotOffsetY = rotationHandleMidwayOffset(frame.halfLength * 2);
  const grips: GripInfo[] = [
    { entityId: id, gripIndex: 0, type: 'center', position: frame.center, movesEntity: true, textGripKind: 'text-move' },
    { entityId: id, gripIndex: 1, type: 'vertex', position: rectLocalWorld(frame, 0, rotOffsetY), movesEntity: false, textGripKind: 'text-rotation' },
    { entityId: id, gripIndex: 2, type: 'edge', position: rectEdgeWorld(frame, EDGE_MAP['text-edge-e']!), movesEntity: false, textGripKind: 'text-edge-e' },
    { entityId: id, gripIndex: 3, type: 'edge', position: rectEdgeWorld(frame, EDGE_MAP['text-edge-n']!), movesEntity: false, textGripKind: 'text-edge-n' },
    { entityId: id, gripIndex: 8, type: 'edge', position: rectEdgeWorld(frame, EDGE_MAP['text-edge-w']!), movesEntity: false, textGripKind: 'text-edge-w' },
    { entityId: id, gripIndex: 9, type: 'edge', position: rectEdgeWorld(frame, EDGE_MAP['text-edge-s']!), movesEntity: false, textGripKind: 'text-edge-s' },
    { entityId: id, gripIndex: 4, type: 'vertex', position: rectCornerWorld(frame, CORNER_MAP['text-corner-ne']!), movesEntity: false, textGripKind: 'text-corner-ne' },
    { entityId: id, gripIndex: 5, type: 'vertex', position: rectCornerWorld(frame, CORNER_MAP['text-corner-nw']!), movesEntity: false, textGripKind: 'text-corner-nw' },
    { entityId: id, gripIndex: 6, type: 'vertex', position: rectCornerWorld(frame, CORNER_MAP['text-corner-sw']!), movesEntity: false, textGripKind: 'text-corner-sw' },
    { entityId: id, gripIndex: 7, type: 'vertex', position: rectCornerWorld(frame, CORNER_MAP['text-corner-se']!), movesEntity: false, textGripKind: 'text-corner-se' },
  ];
  return grips;
}

/** Post-resize `RectFrame` → patch, picking MTEXT `width` vs TEXT `widthFactor`. */
function framePatch(entity: DxfText, newFrame: RectFrame): TextTransformPatch {
  const newWidth = newFrame.halfWidth * 2;
  // The grip box is the VISUAL glyph box (cap height); recover the nominal em `height` by
  // dividing the dragged box height by the visual extent ratio — the SAME ratio the forward
  // `resolveTextBox` applies — so the box holds on release (no jump). Em-box path → ratio 1.
  const nominalHeight = (newFrame.halfLength * 2) / textVisualExtentRatio(entity);
  const patch: TextTransformPatch = { position: textBoxToPosition(newFrame, entity), height: nominalHeight };
  if (isMTextBox(entity)) {
    patch.width = newWidth;
  } else {
    // Divide by the REAL glyph advance (widthFactor=1) at the NOMINAL height — the SAME base
    // `effectiveTextWidth` uses — so the resized box holds (`effectiveTextWidth(after) === newWidth`).
    patch.widthFactor = newWidth / baseTextAdvanceWorld(entity, nominalHeight);
  }
  return patch;
}

/**
 * Rotate the box around `pivot` (default bbox-centre) by the cursor sweep, then
 * re-home `position` so the centre holds. `delta` lets us reconstruct the start
 * angle (`currentPos − delta`) the same way the commit does.
 */
function applyTextRotation(frame: RectFrame, input: TextGripDragInput): TextTransformPatch {
  const { entity, delta } = input;
  const pivot = input.pivot ?? frame.center;
  const cur = input.currentPos ?? translatePoint(entity.position, delta);
  const start = { x: cur.x - delta.x, y: cur.y - delta.y };
  const a0 = Math.atan2(start.y - pivot.y, start.x - pivot.x);
  const a1 = Math.atan2(cur.y - pivot.y, cur.x - pivot.x);
  let sweepDeg = (a1 - a0) * RAD_TO_DEG;
  if (input.ortho) sweepDeg = Math.round(sweepDeg / 45) * 45;
  const rel = rotateVector({ x: frame.center.x - pivot.x, y: frame.center.y - pivot.y }, sweepDeg);
  const newFrame: RectFrame = {
    center: translatePoint(pivot, rel),
    rotationDeg: (entity.rotation ?? 0) + sweepDeg,
    halfWidth: frame.halfWidth,
    halfLength: frame.halfLength,
  };
  return { rotation: newFrame.rotationDeg, position: textBoxToPosition(newFrame, entity) };
}

/**
 * THE single pure transform shared by ghost-preview and commit (preview ≡ commit).
 * Routes a text grip kind to: whole-box translate (move), centre-pivot rotate, or
 * the shared `rect-grip-engine` corner/edge resize → a top-level field patch.
 */
export function applyTextGripDrag(kind: TextGripKind, input: TextGripDragInput): TextTransformPatch {
  const { entity, delta } = input;
  if (kind === 'text-move') {
    return { position: translatePoint(entity.position, delta) };
  }
  const frame = resolveTextBox(entity);
  if (kind === 'text-rotation') return applyTextRotation(frame, input);
  const corner = CORNER_MAP[kind];
  if (corner) return framePatch(entity, applyRectCornerDrag(frame, corner, delta, textResizeLimits(), input.ortho));
  const edge = EDGE_MAP[kind];
  if (edge) return framePatch(entity, applyRectEdgeDrag(frame, edge, delta, textResizeLimits()));
  return {};
}
