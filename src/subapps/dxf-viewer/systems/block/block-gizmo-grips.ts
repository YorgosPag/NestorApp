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

/** The two whole-block gizmo grip kinds (mirror `group-move` / `group-rotation`). */
export const BLOCK_MOVE_KIND: BlockGripKind = 'block-move';
export const BLOCK_ROTATION_KIND: BlockGripKind = 'block-rotation';

/**
 * The 2 whole-block handles — thin BLOCK wrapper over {@link getContainerGizmoGrips}
 * that tags both handles `on: 'block'`. The gizmo geometry lives once in the shared core.
 */
export function getBlockGizmoGrips(block: BlockEntity, bounds: GroupSelectionBounds): GripInfo[] {
  return getContainerGizmoGrips(
    block.id,
    bounds,
    { on: 'block', kind: BLOCK_MOVE_KIND },
    { on: 'block', kind: BLOCK_ROTATION_KIND },
  );
}
