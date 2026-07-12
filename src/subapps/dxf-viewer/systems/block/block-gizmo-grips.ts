/**
 * ADR-640 — BLOCK gizmo grips (thin wrapper over the shared container gizmo core).
 *
 * A selected BLOCK shows the SAME whole-container gizmo a GROUP shows (ADR-575 §8): ONE
 * MOVE cross + ONE rotation handle at the bbox centre, INSTEAD of per-member grips (those
 * are suppressed in `grip-registry` — every expanded member carries the SAME `block.id`,
 * so only one would show, mis-reading as «one object selected»). The gizmo GEOMETRY lives
 * once in {@link getContainerGizmoGrips}; this wrapper only supplies the block-tagged
 * `gripKind` (`block-move` / `block-rotation`), so there is ZERO duplicated grip math.
 *
 *   - `block-move`     → centre grip, 4-arrow MOVE glyph + whole-block translate
 *                        (`calculateMovedGeometry` case 'block' → translate `position`,
 *                        INSERT semantics — members are NOT recursed, unlike a group).
 *   - `block-rotation` → rotation handle midway toward the bottom edge; commit routes
 *                        through the canonical `RotateEntityCommand` (`rotateEntity`
 *                        case 'block' → rotate the insertion point + accumulate rotation).
 *
 * @see systems/group/group-gizmo-grips.ts — `getContainerGizmoGrips` (the shared core)
 * @see systems/block/block-selection-bounds.ts — `computeBlockSelectionBounds` (bbox+centre)
 */

import type { BlockEntity } from '../../types/entities';
import type { GripInfo } from '../../hooks/grip-types';
import type { BlockGripKind } from '../../hooks/grip-kinds';
import { getContainerGizmoGrips } from '../group/group-gizmo-grips';
import type { GroupSelectionBounds } from '../group/group-selection-bounds';
// ADR-641 — the 8 wall-grade perimeter box handles (4 corners + 4 edges) a selected block
// shows in ADDITION to the move/rotation gizmo. Positions + drag reuse the shared rect SSoT.
import { getBlockBoxGrips } from './block-box-grips';

/** The two whole-block gizmo grip kinds (mirror `group-move` / `group-rotation`). */
export const BLOCK_MOVE_KIND: BlockGripKind = 'block-move';
export const BLOCK_ROTATION_KIND: BlockGripKind = 'block-rotation';

/**
 * The whole-block selection grips: the 2 gizmo handles (move cross + rotation, shared
 * {@link getContainerGizmoGrips} core) PLUS the 8 wall-grade perimeter box handles (4 corners
 * + 4 edge midpoints — {@link getBlockBoxGrips}), so a selected block exposes the SAME
 * transform vocabulary a selected wall does (Giorgio 2026-07-12). Grip indices: 0 = move,
 * 1 = rotation, 2-5 = corners, 6-9 = edges — all keyed on `block.id` (no member carries it).
 * The gizmo + box geometry each live once in their shared SSoT → ZERO duplicated grip math.
 */
export function getBlockGizmoGrips(block: BlockEntity, bounds: GroupSelectionBounds): GripInfo[] {
  return [
    ...getContainerGizmoGrips(
      block.id,
      bounds,
      { on: 'block', kind: BLOCK_MOVE_KIND },
      { on: 'block', kind: BLOCK_ROTATION_KIND },
    ),
    ...getBlockBoxGrips(block.id, bounds),
  ];
}
