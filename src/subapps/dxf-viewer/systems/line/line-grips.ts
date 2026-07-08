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
 * on canvas. Now ONE function emits all 5 — start/end/midpoint + rotation (¼-east,
 * Slice F) + the MOVE cross (¼-west, Slice G.5) (Giorgio 2026-06-30 «μία πηγή αλήθειας»).
 *
 * The line is a DXF primitive (`start`/`end`, no `params`), so it cannot consume
 * the parametric `axis-box-grips` family the way a wall does. But the two pieces a
 * rotation handle actually needs — its POSITION and its drag TRANSFORM — are
 * entity-agnostic, so this module REUSES the exact same SSoT the wall uses:
 *
 *   - rotation position → `axisQuarterRotationHandleWorld` (the `'axis-quarter'`
 *                 placement the straight wall renders: on the centreline, at ¼ axis
 *                 length toward the east end = between the centre and the right endpoint).
 *   - move position     → `axisQuarterMoveHandleWorld` (its ¼-WEST mirror, Slice G.5).
 *   - rotate transform  → `rotateAxisPointsAboutPivot` (the anchor-relative swept-angle
 *                 rotate-about-pivot SSoT shared by wall / beam / column, ADR-397).
 *   - move transform    → the SHARED wall MOVE pipeline (4-arrow glyph + per-arm
 *                 directional click→prompt + whole-entity translate); the line adds
 *                 ONLY the `'line-move'` kind + the ¼-west position, no new mechanism.
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
import { axisToRectFrame, axisQuarterRotationHandleWorld, axisQuarterMoveHandleWorld, applyAxisBoxGripDrag } from '../../bim/grips/axis-box-grips';
import type { RectFrame } from '../../bim/grips/rect-frame';

/** The single line rotation grip kind (mirror `wall-rotation`). */
export const LINE_ROTATION_KIND: LineGripKind = 'line-rotation';

/** The single line MOVE grip kind (mirror `wall-midpoint`, ADR-363 Slice G.5). */
export const LINE_MOVE_KIND: LineGripKind = 'line-move';

/**
 * The line's centre-axis `RectFrame`: a ZERO-WIDTH axis box (a line has no
 * perpendicular footprint, so only the axis matters). The ONE place this frame is
 * built, consumed by every line handle placement below — so they all read the SAME
 * geometry and can never diverge (no per-handle `axisToRectFrame({…, width: 0})` copy).
 */
function lineAxisBoxFrame(start: Point2D, end: Point2D): RectFrame {
  return axisToRectFrame({ start, end, width: 0 });
}

/**
 * World position of the line's rotation handle: the SAME `'axis-quarter'` point
 * the straight wall uses (centreline, ¼ axis length toward the east end). Identical
 * to the wall by construction — one shared SSoT.
 */
export function lineRotationHandlePos(start: Point2D, end: Point2D): Point2D {
  return axisQuarterRotationHandleWorld(lineAxisBoxFrame(start, end));
}

/**
 * World position of the line's MOVE cross: the ¼-WEST point — the mirror image of
 * the rotation handle (centreline, ¼ axis length toward the west end), via the SAME
 * `axisQuarterMoveHandleWorld` SSoT. One placement source with the wall by
 * construction; only the sign differs (Giorgio 2026-06-30 «¼-δυτικά, συμμετρικό»).
 */
export function lineMoveHandlePos(start: Point2D, end: Point2D): Point2D {
  return axisQuarterMoveHandleWorld(lineAxisBoxFrame(start, end));
}

/**
 * The 4 grips of a plain DXF line — the SSoT both grip paths consume:
 *   0 → start endpoint (reshape)
 *   1 → end endpoint (reshape)
 *   2 → midpoint at the CENTRE (plain whole-line translate; `movesEntity` →
 *       ORTHO-eligible, `edgeVertexIndices` keeps the StretchEntityCommand commit
 *       path byte-identical). Kept as the classic AutoCAD midpoint grip (Giorgio
 *       2026-06-30 «το κέντρο μένει»); the directional MOVE cross is grip 4.
 *   3 → rotation handle (ADR-363 Slice F — wall parity: `'axis-quarter'` position +
 *       `lineGripKind` opts into the shared hot-grip rotate flow + curved glyph)
 *   4 → MOVE cross at ¼-WEST (ADR-363 Slice G.5 — `wall-midpoint` parity: the
 *       4-arrow MOVE glyph + 3-click hot-grip move + per-arm directional
 *       click→distance prompt, all the SHARED move pipeline; `movesEntity` +
 *       `edgeVertexIndices` give it the identical whole-line translate as grip 2).
 *
 * `type: 'vertex'` on BOTH the rotation and the move grip so they are never filtered
 * by the showMidpoints/showCenters grip preferences — selecting the line always shows
 * both handles (Giorgio «όταν επιλέγω γραμμή, να εμφανίζεται το σημάδι μετακίνησης»).
 * Returns the hooks `GripInfo`; the 2D renderer maps each to its render `GripInfo`
 * (+`shape`) — see `LineRenderer.getGrips`. The glyph (`'line-move'` → 4-arrow) comes
 * from the shared `gripGlyphShape` registry; the screen-rotation from
 * `withMoveGlyphRotation` (both activate automatically once the kind is emitted).
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
      movesEntity: false,
      gripKind: { on: 'line', kind: LINE_ROTATION_KIND },
    },
    {
      entityId, gripIndex: 4, type: 'vertex',
      position: lineMoveHandlePos(start, end),
      movesEntity: true, edgeVertexIndices: [0, 1],
      gripKind: { on: 'line', kind: LINE_MOVE_KIND },
    },
  ];
}

/**
 * ADR-357/363 — the alignment-tracking anchor point(s) for a plain-line grip drag, so the
 * SAME centralized Object-Snap-Tracking (`resolveActionAlignmentTracking`) the dimension and
 * drawing flows use lights up while a line grip is dragged. Mirror of
 * `getDimGripAlignmentAnchors` (its dim sibling) — ONE resolver, per-family anchor providers.
 *
 *   • endpoint reshape (grip 0 = start, grip 1 = end) → the OTHER, FIXED endpoint: the moving
 *     end tracks horizontally/vertically off the fixed end ⊕ ambient neighbours (AutoCAD/Revit).
 *   • centre-move (grip 2) / MOVE-cross (grip 4) → the move BASE point (`dragAnchor`): the whole
 *     line slides along ortho/aligned traces from where the drag started ⊕ ambient.
 *   • rotation handle (grip 3, `line-rotation`) → `null`: the rotate flow already shows the
 *     centralized POLAR/AutoAlign traces via `resolveRotationTracking` in the ghost (no double).
 *
 * Returns `null` when there is no meaningful anchor (rotation, or a move with no base yet), so
 * the caller keeps the raw cursor. Pure — zero React / DOM / store deps.
 */
export function getLineGripAlignmentAnchors(
  gripIndex: number,
  lineGripKind: LineGripKind | null | undefined,
  line: { readonly start: Point2D; readonly end: Point2D },
  dragAnchor: Point2D | null | undefined,
): Point2D[] | null {
  if (lineGripKind === LINE_ROTATION_KIND) return null;
  if (gripIndex === 0) return [line.end];
  if (gripIndex === 1) return [line.start];
  // Whole-line translate (classic midpoint grip 2 or the ¼-west MOVE cross grip 4).
  return dragAnchor ? [{ x: dragAnchor.x, y: dragAnchor.y }] : null;
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
