/**
 * ADR-363 Slice F — Plain DXF LINE rotation grip (pure helpers).
 *
 * The line is a DXF primitive (`start`/`end`, no `params`), so it cannot consume
 * the parametric `axis-box-grips` grip family the way a wall does. But the two
 * pieces a rotation handle actually needs — its POSITION and its drag TRANSFORM —
 * are entity-agnostic, so this module REUSES the exact same SSoT the wall uses:
 *
 *   - position  → `axisQuarterRotationHandleWorld` (the `'axis-quarter'` placement
 *                 the straight wall renders: on the centreline, at ¼ axis length
 *                 toward the east end = between the centre and the right endpoint).
 *   - transform → `rotateAxisPointsAboutPivot` (the anchor-relative swept-angle
 *                 rotate-about-pivot SSoT shared by wall / beam / column, ADR-397).
 *
 * There is NO second placement formula and NO re-implemented cos/sin here — the
 * wall and the line are guaranteed identical by construction (Giorgio 2026-06-30
 * «parity με τον τοίχο, μηδέν νέος μηχανισμός»). The glyph (curved arrow) + the
 * 6-click/free/typed hot-grip flow + the commit (`RotateEntityCommand`) are all
 * the shared pipeline; this module only supplies the geometry.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/axis-box-grips.ts — `axisQuarterRotationHandleWorld` (shared position)
 * @see bim/grips/grip-math.ts — `rotateAxisPointsAboutPivot` (shared rotate SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineGripKind } from '../../hooks/grip-types';
import { axisToRectFrame, axisQuarterRotationHandleWorld } from '../../bim/grips/axis-box-grips';
import { rotateAxisPointsAboutPivot } from '../../bim/grips/grip-math';

/** The single line rotation grip kind (mirror `wall-rotation`). */
export const LINE_ROTATION_KIND: LineGripKind = 'line-rotation';

/**
 * World position of the line's rotation handle: the SAME `'axis-quarter'` point
 * the straight wall uses (centreline, ¼ axis length toward the east end), built
 * from a zero-width axis frame (a line has no perpendicular footprint, so only the
 * axis matters). Identical to the wall by construction — one shared SSoT.
 */
export function lineRotationHandlePos(start: Point2D, end: Point2D): Point2D {
  return axisQuarterRotationHandleWorld(axisToRectFrame({ start, end, width: 0 }));
}

export interface LineRotationDragInput {
  readonly start: Point2D;
  readonly end: Point2D;
  /** World-space delta from the drag anchor to the current cursor position. */
  readonly delta: Point2D;
  /** World cursor position (= anchor + delta). The swept angle is anchor-relative. */
  readonly currentPos: Point2D;
  /**
   * Rotation centre. When set (the AutoCAD ROTATE «specify centre» flow) the line
   * spins around this point; absent → the line midpoint. Mirror of `rotateWall`.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: rotate the line's `start`/`end` about the pivot (or midpoint) by
 * the anchor-relative swept angle. Mirror of `wall-grip-transforms.rotateWall` — the
 * handle sits OFF the axis, so we measure the angle SWEPT since mousedown (anchor =
 * `currentPos − delta`) instead of the cursor's absolute bearing (no snap on grab).
 * Returns `null` for a degenerate sweep (cursor on the pivot) so callers no-op.
 */
export function applyLineRotationDrag(input: LineRotationDragInput): { start: Point2D; end: Point2D } | null {
  const { start, end, delta, currentPos, pivot } = input;
  const centre: Point2D = pivot ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const anchor: Point2D = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const rotated = rotateAxisPointsAboutPivot([start, end], { pivot: centre, anchor, currentPos });
  if (!rotated) return null;
  return { start: rotated[0], end: rotated[1] };
}
