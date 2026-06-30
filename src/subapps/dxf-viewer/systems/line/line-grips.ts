/**
 * ADR-363 Slice F/G.4 — Plain DXF LINE grip SSoT (pure helpers).
 *
 * The SINGLE source of truth for the grips of a plain DXF `line` primitive,
 * consumed by BOTH grip paths so they can never diverge (mirror `text-grips.ts`
 * ↔ `TextRenderer.getGrips`):
 *   - `computeDxfEntityGrips` (case 'line')  → interaction + 3D hit-testing.
 *   - `LineRenderer.getGrips`                → on-canvas 2D grip painting.
 *
 * Before this module the line grips were hand-duplicated in those two places
 * (the renderer emitted only 3 — start/end/midpoint — and even diverged on the
 * midpoint `movesEntity`/`edgeVertexIndices`), so the rotation handle was invisible
 * on canvas. Now ONE function emits all 4 (Giorgio 2026-06-30 «μία πηγή αλήθειας»).
 *
 * The line is a DXF primitive (`start`/`end`, no `params`), so it cannot consume
 * the parametric `axis-box-grips` family the way a wall does. But the two pieces a
 * rotation handle actually needs — its POSITION and its drag TRANSFORM — are
 * entity-agnostic, so this module REUSES the exact same SSoT the wall uses:
 *
 *   - position  → `axisQuarterRotationHandleWorld` (the `'axis-quarter'` placement
 *                 the straight wall renders: on the centreline, at ¼ axis length
 *                 toward the east end = between the centre and the right endpoint).
 *   - transform → `rotateAxisPointsAboutPivot` (the anchor-relative swept-angle
 *                 rotate-about-pivot SSoT shared by wall / beam / column, ADR-397).
 *
 * NO second placement formula and NO re-implemented cos/sin here — the wall and the
 * line are guaranteed identical by construction (Giorgio «parity με τον τοίχο, μηδέν
 * νέος μηχανισμός»). The glyph (curved arrow) + the hot-grip flow + the commit
 * (`RotateEntityCommand`) are all the shared pipeline; this module only supplies the
 * geometry. Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/axis-box-grips.ts — `axisQuarterRotationHandleWorld` (shared position)
 * @see bim/grips/grip-math.ts — `rotateAxisPointsAboutPivot` (shared rotate SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F / G.4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, LineGripKind } from '../../hooks/grip-types';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import { axisToRectFrame, axisQuarterRotationHandleWorld, applyAxisBoxGripDrag } from '../../bim/grips/axis-box-grips';

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

/**
 * The 4 grips of a plain DXF line — the SSoT both grip paths consume:
 *   0 → start endpoint (reshape)
 *   1 → end endpoint (reshape)
 *   2 → midpoint MOVE (whole-line translate; `movesEntity` → ORTHO-eligible,
 *       `edgeVertexIndices` keeps the StretchEntityCommand commit path byte-identical)
 *   3 → rotation handle (ADR-363 Slice F — wall parity: `'axis-quarter'` position +
 *       `lineGripKind` opts into the shared hot-grip rotate flow + curved glyph)
 *
 * `type: 'vertex'` on the rotation grip so it is never filtered by the
 * showMidpoints/showCenters grip preferences. Returns the hooks `GripInfo`; the
 * 2D renderer maps each to its render `GripInfo` (+`shape`) — see `LineRenderer.getGrips`.
 */
export function getLineGrips(entityId: string, start: Point2D, end: Point2D): GripInfo[] {
  return [
    { entityId, gripIndex: 0, type: 'vertex', position: start, movesEntity: false },
    { entityId, gripIndex: 1, type: 'vertex', position: end, movesEntity: false },
    {
      entityId, gripIndex: 2, type: 'edge',
      position: calculateMidpoint(start, end),
      movesEntity: true, edgeVertexIndices: [0, 1],
    },
    {
      entityId, gripIndex: 3, type: 'vertex',
      position: lineRotationHandlePos(start, end),
      movesEntity: false, lineGripKind: LINE_ROTATION_KIND,
    },
  ];
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
 * Rotate the line's `start`/`end` about the pivot (or midpoint) by the anchor-relative
 * swept angle. Thin adapter over the SHARED `applyAxisBoxGripDrag('rotation', …)` —
 * the EXACT rotation engine wall / beam / foundation-strip use (anchor-relative swept
 * angle about pivot-or-midpoint via `rotateAxisPointsAboutPivot`). A line = a zero-width
 * axis box, so we pass `width: 0` and drop the patch's `width`. NO re-implemented rotate
 * math here — one engine, N consumers (Giorgio «μία πηγή αλήθειας»). Returns `null` for
 * a degenerate / zero-delta sweep (cursor on the pivot) so callers no-op.
 */
export function applyLineRotationDrag(input: LineRotationDragInput): { start: Point2D; end: Point2D } | null {
  const patch = applyAxisBoxGripDrag('rotation', {
    originalParams: { start: input.start, end: input.end, width: 0 },
    delta: input.delta,
    minWidthMm: 0,
    currentPos: input.currentPos,
    ...(input.pivot ? { pivot: input.pivot } : {}),
  });
  return patch ? { start: patch.start, end: patch.end } : null;
}
