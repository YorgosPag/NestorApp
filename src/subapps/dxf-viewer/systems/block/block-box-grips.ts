/**
 * ADR-641 — BLOCK selection BOX grips (SSoT, pure): the 8 perimeter transform handles a
 * selected block shows IN ADDITION to the whole-block move cross + rotation handle, giving
 * the block the SAME wall-grade grip vocabulary a linear BIM element exposes when selected
 * (Giorgio 2026-07-12: «οι ίδιες λαβές που δείχνει ένας τοίχος»). Figma / Cinema 4D transform
 * box: 4 corners (2-DOF scale, opposite corner fixed) + 4 edge midpoints (1-axis stretch,
 * opposite edge fixed).
 *
 * FULL reuse — ZERO new geometry / scale math:
 *   - Handle POSITIONS come from the shared rotated-rectangle SSoT (`rect-frame`) on the
 *     block's world-AABB (`computeBlockSelectionBounds`, rotationDeg = 0), the SAME core the
 *     wall / column / foundation grips place their corners/edges with.
 *   - The corner/edge DRAG runs the shared opposite-element-fixed engine (`rect-grip-engine`),
 *     and the resulting per-axis scale is applied through the ONE block scale SSoT
 *     (`scaleEntity` case 'block', ADR-348/640) → an INSERT `{ position, scale }` patch. The
 *     canonical `block.entities` (definition-local members) stay immutable — AutoCAD block
 *     scale semantics.
 *
 * Known limitation (ADR-641): the box is the world-AABB (axis-aligned, like the group gizmo),
 * so a corner drag is WYSIWYG-exact for `rotation = 0` (the common case). A rotated block scales
 * along its own local axes (INSERT semantics), so the AABB handle then approximates — an
 * oriented-box refinement is a follow-up.
 *
 * @see bim/grips/rect-frame.ts — corner/edge world-position readers (shared)
 * @see bim/grips/rect-grip-engine.ts — opposite-element-fixed resize transforms (shared)
 * @see systems/scale/scale-entity-transform.ts — `scaleEntity` case 'block' (the scale SSoT)
 * @see systems/block/block-gizmo-grips.ts — composes these with the move/rotation gizmo
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, BlockEntity } from '../../types/entities';
import type { GripInfo } from '../../hooks/grip-types';
import type { BlockGripKind } from '../../hooks/grip-kinds';
import type { GroupSelectionBounds } from '../group/group-selection-bounds';
import type { RectFrame, RectCorner, RectEdge, RectSign } from '../../bim/grips/rect-frame';
import { rectCornerWorld, rectEdgeWorld } from '../../bim/grips/rect-frame';
import { applyRectCornerDrag, applyRectEdgeDrag } from '../../bim/grips/rect-grip-engine';
import { scaleEntity } from '../scale/scale-entity-transform';
import { computeBlockSelectionBounds } from './block-selection-bounds';

/**
 * Entity-agnostic role of a block box handle. `corner-*` = 2-DOF scale, `edge-*` = 1-axis
 * stretch. Mapped 1:1 to the tagged `block-corner-*` / `block-edge-*` grip kinds.
 */
export type BlockBoxGripRole =
  | 'corner-ne'
  | 'corner-nw'
  | 'corner-sw'
  | 'corner-se'
  | 'edge-n'
  | 'edge-e'
  | 'edge-s'
  | 'edge-w';

/** Stable emission order → grip indices 2-5 (corners) then 6-9 (edges); 0/1 = move/rotation. */
const CORNER_ORDER: readonly BlockBoxGripRole[] = ['corner-ne', 'corner-nw', 'corner-sw', 'corner-se'];
const EDGE_ORDER: readonly BlockBoxGripRole[] = ['edge-n', 'edge-e', 'edge-s', 'edge-w'];

const CORNER_SIGN: Readonly<Record<string, RectCorner>> = {
  'corner-ne': { sx: 1, sy: 1 },
  'corner-nw': { sx: -1, sy: 1 },
  'corner-sw': { sx: -1, sy: -1 },
  'corner-se': { sx: 1, sy: -1 },
};

const EDGE_SPEC: Readonly<Record<string, RectEdge>> = {
  'edge-e': { axis: 'x', sign: 1 },
  'edge-w': { axis: 'x', sign: -1 },
  'edge-n': { axis: 'y', sign: 1 },
  'edge-s': { axis: 'y', sign: -1 },
};

const ROLE_TO_KIND: Readonly<Record<BlockBoxGripRole, BlockGripKind>> = {
  'corner-ne': 'block-corner-ne',
  'corner-nw': 'block-corner-nw',
  'corner-sw': 'block-corner-sw',
  'corner-se': 'block-corner-se',
  'edge-n': 'block-edge-n',
  'edge-e': 'block-edge-e',
  'edge-s': 'block-edge-s',
  'edge-w': 'block-edge-w',
};

const KIND_TO_ROLE: Readonly<Partial<Record<BlockGripKind, BlockBoxGripRole>>> = Object.fromEntries(
  (Object.keys(ROLE_TO_KIND) as BlockBoxGripRole[]).map((role) => [ROLE_TO_KIND[role], role]),
) as Readonly<Partial<Record<BlockGripKind, BlockBoxGripRole>>>;

/** Scene-unit minimum half-extent — just prevents the box inverting / collapsing to zero. */
const MIN_HALF = 1e-6;

/** Block world-AABB → an axis-aligned (`rotationDeg = 0`) `RectFrame` in scene units. */
function boundsToRectFrame(bounds: GroupSelectionBounds): RectFrame {
  return {
    center: bounds.center,
    rotationDeg: 0,
    halfWidth: (bounds.max.x - bounds.min.x) / 2,
    halfLength: (bounds.max.y - bounds.min.y) / 2,
  };
}

/** The block box handle role a `block-*` grip kind maps to, or `null` for move/rotation. */
export function blockBoxRoleFromKind(kind: BlockGripKind | undefined | null): BlockBoxGripRole | null {
  if (kind == null) return null;
  return KIND_TO_ROLE[kind] ?? null;
}

/** True for the 8 box (corner/edge) grip kinds — NOT `block-move` / `block-rotation`. */
export function isBlockBoxGripKind(kind: BlockGripKind | undefined | null): boolean {
  return blockBoxRoleFromKind(kind) !== null;
}

/**
 * The 8 perimeter box grips (4 corners + 4 edge midpoints) for a selected block, keyed on the
 * block id (grip indices 2-9 — 0/1 belong to the move/rotation gizmo). Corners are `type:'corner'`
 * (structural → always visible); edges are `type:'midpoint'` (helper → gated by the «Midpoints»
 * grip-type preference, wall parity). A degenerate (zero-area) bbox emits no box grips.
 */
export function getBlockBoxGrips(blockId: string, bounds: GroupSelectionBounds): GripInfo[] {
  const frame = boundsToRectFrame(bounds);
  if (frame.halfWidth < MIN_HALF || frame.halfLength < MIN_HALF) return [];

  const grips: GripInfo[] = [];
  CORNER_ORDER.forEach((role, i) => {
    grips.push({
      entityId: blockId,
      gripIndex: 2 + i,
      type: 'corner',
      position: rectCornerWorld(frame, CORNER_SIGN[role]),
      movesEntity: false,
      gripKind: { on: 'block', kind: ROLE_TO_KIND[role] },
    });
  });
  EDGE_ORDER.forEach((role, i) => {
    grips.push({
      entityId: blockId,
      gripIndex: 6 + i,
      type: 'midpoint',
      position: rectEdgeWorld(frame, EDGE_SPEC[role]),
      movesEntity: false,
      gripKind: { on: 'block', kind: ROLE_TO_KIND[role] },
    });
  });
  return grips;
}

/** The `{ position, scale }` INSERT patch produced by a box grip drag (mirror `scaleEntity` block). */
export interface BlockBoxScalePatch {
  readonly position: Point2D;
  readonly scale: Point2D;
}

/**
 * Pure transform: a block box grip drag → `{ position, scale }` INSERT patch, or `null` for a
 * no-op (zero delta / degenerate bbox / unit scale). The corner/edge drag keeps the OPPOSITE
 * corner/edge fixed (shared `rect-grip-engine`); the resulting per-axis scale factor is applied
 * about that fixed point through the ONE block scale SSoT (`scaleEntity` case 'block'), so the
 * canonical definition members stay untouched. Consumed by BOTH the live ghost (preview) and the
 * commit → preview ≡ commit by identity.
 */
export function applyBlockBoxGripDrag(
  role: BlockBoxGripRole,
  block: BlockEntity,
  delta: Point2D,
): BlockBoxScalePatch | null {
  if (delta.x === 0 && delta.y === 0) return null;
  const bounds = computeBlockSelectionBounds(block);
  if (!bounds) return null;
  const frame = boundsToRectFrame(bounds);
  if (frame.halfWidth < MIN_HALF || frame.halfLength < MIN_HALF) return null;
  const limits = { minHalfWidth: MIN_HALF, minHalfLength: MIN_HALF };

  let base: Point2D;
  let sx: number;
  let sy: number;
  const corner = CORNER_SIGN[role];
  if (corner) {
    const nf = applyRectCornerDrag(frame, corner, delta, limits);
    sx = nf.halfWidth / frame.halfWidth;
    sy = nf.halfLength / frame.halfLength;
    // The fixed point is the OPPOSITE corner (exactly what `rect-grip-engine` pins).
    base = rectCornerWorld(frame, { sx: (-corner.sx) as RectSign, sy: (-corner.sy) as RectSign });
  } else {
    const edge = EDGE_SPEC[role];
    if (!edge) return null;
    const nf = applyRectEdgeDrag(frame, edge, delta, limits);
    sx = edge.axis === 'x' ? nf.halfWidth / frame.halfWidth : 1;
    sy = edge.axis === 'y' ? nf.halfLength / frame.halfLength : 1;
    // The fixed point sits on the OPPOSITE edge midpoint.
    base = rectEdgeWorld(frame, { axis: edge.axis, sign: (-edge.sign) as RectSign });
  }

  if (sx === 1 && sy === 1) return null;
  const patch = scaleEntity(block as unknown as Entity, base, sx, sy) as {
    position?: Point2D;
    scale?: Point2D;
  };
  if (!patch.position || !patch.scale) return null;
  return { position: patch.position, scale: patch.scale };
}
