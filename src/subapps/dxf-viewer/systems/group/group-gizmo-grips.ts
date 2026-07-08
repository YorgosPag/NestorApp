/**
 * ADR-575 §8 — GROUP gizmo grips (SSoT, pure helpers).
 *
 * Emits the TWO whole-group handles — the MOVE cross + the rotation handle — that a
 * selected `type:'group'` container shows at the centre of its bounding box (Revit /
 * Cinema 4D group gizmo, Giorgio «ένα κοινό βελάκι στο κέντρο»), INSTEAD of per-member
 * grips (those are suppressed in `grip-registry` — every expanded member carries the
 * SAME `group.id`, so only one would show, mis-reading as «one object selected»).
 *
 *   - `group-move`     → centre grip, 4-arrow MOVE glyph + whole-group translate
 *                        (`calculateMovedGeometry` case 'group' → recurse members).
 *   - `group-rotation` → rotation handle midway between the centre and the bottom
 *                        edge (the SAME `rotationHandleMidwayOffset` policy the column /
 *                        text / rectangle use); commit routes through the canonical
 *                        `RotateEntityCommand` (pivot = bbox centre → `rotateEntity`
 *                        case 'group' → recurse members).
 *
 * This is the DIRECT mirror of `getPolylineMoveRotateGrips` (`systems/polyline/
 * polyline-grips.ts`) — a whole-entity move + rotate on a bbox — but on the group's
 * WORLD-axis-aligned AABB (a group has no single orientation, so `rotationDeg = 0`).
 * ZERO new glyph math / rotation engine / group transform: the bbox + centre come from
 * `computeGroupSelectionBounds` (ADR-575 Phase 1), the rotation-handle offset from the
 * shared `rotationHandleMidwayOffset` SSoT, the placement from `rect-frame`.
 *
 * Both handles are `type: 'vertex'` so they are NEVER filtered by the showMidpoints /
 * showCenters grip preferences — selecting a group ALWAYS shows the gizmo (mirror of
 * the plain-line move + rotation handles). The grip indices (0 = move, 1 = rotation)
 * are keyed on `group.id`, which no member carries → no collision.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see systems/polyline/polyline-grips.ts — `getPolylineMoveRotateGrips` (the mirror)
 * @see systems/group/group-selection-bounds.ts — `computeGroupSelectionBounds` (bbox+centre)
 * @see bim/grips/rotation-handle-policy.ts — `rotationHandleMidwayOffset` (SSoT offset)
 * @see docs/centralized-systems/reference/adrs/ADR-575-join-group-inverse-of-explode.md §8
 */

import type { GroupEntity } from '../../types/entities';
import type { GripInfo, GroupGripKind } from '../../hooks/grip-types';
import { rectLocalWorld, type RectFrame } from '../../bim/grips/rect-frame';
import { rotationHandleMidwayOffset } from '../../bim/grips/rotation-handle-policy';
import type { GroupSelectionBounds } from './group-selection-bounds';

/** The two whole-group gizmo grip kinds (mirror `polyline-move` / `polyline-rotation`). */
export const GROUP_MOVE_KIND: GroupGripKind = 'group-move';
export const GROUP_ROTATION_KIND: GroupGripKind = 'group-rotation';

/** Grip index of the MOVE cross (0) and the rotation handle (1) — keyed on `group.id`. */
export const GROUP_MOVE_GRIP_INDEX = 0;
export const GROUP_ROTATION_GRIP_INDEX = 1;

/**
 * The 2 whole-group handles (MOVE cross @ centre + rotation handle midway toward the
 * bottom edge), placed on the group's world-axis AABB. Returns the hooks `GripInfo`;
 * the group gizmo render leaf maps each to its glyph (`gripGlyphShape`). A degenerate
 * (zero-area) bbox keeps both handles at the centre (mirror the polyline degenerate ring).
 */
export function getGroupGizmoGrips(group: GroupEntity, bounds: GroupSelectionBounds): GripInfo[] {
  const halfWidth = (bounds.max.x - bounds.min.x) / 2;
  const halfLength = (bounds.max.y - bounds.min.y) / 2;
  // World-axis AABB → a zero-rotation `RectFrame`, so the rotation handle placement
  // reuses the SAME `rect-frame` + `rotationHandleMidwayOffset` SSoT the rectangle /
  // column / text use (no bespoke offset formula).
  const frame: RectFrame = { center: bounds.center, rotationDeg: 0, halfWidth, halfLength };
  const rotOffsetY = rotationHandleMidwayOffset(halfLength * 2); // −halfLength/2 (midway to bottom edge)

  return [
    {
      entityId: group.id,
      gripIndex: GROUP_MOVE_GRIP_INDEX,
      type: 'vertex',
      position: bounds.center,
      movesEntity: true,
      gripKind: { on: 'group', kind: GROUP_MOVE_KIND },
    },
    {
      entityId: group.id,
      gripIndex: GROUP_ROTATION_GRIP_INDEX,
      type: 'vertex',
      position: rectLocalWorld(frame, 0, rotOffsetY),
      movesEntity: false,
      gripKind: { on: 'group', kind: GROUP_ROTATION_KIND },
    },
  ];
}
