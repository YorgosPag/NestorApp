/**
 * ADR-561 — Plain DXF ARC grip SSoT (pure helpers).
 *
 * The SINGLE source of truth for an `arc` primitive's grips, consumed by BOTH
 * grip paths so they can never diverge (mirror `systems/line/line-grips.ts` ↔
 * `LineRenderer.getGrips`):
 *   - `computeDxfEntityGrips` (case 'arc') → interaction + hit-testing.
 *   - `ArcRenderer.getGrips`               → on-canvas 2D grip painting.
 *
 * Unlike the circle, the arc has an intrinsic orientation (start/end angle), so it
 * gets BOTH a MOVE glyph AND a rotation handle — BOTH placed ON the visible curve at
 * the arc midpoint (Giorgio 2026-07-21), NOT at the far centre:
 *   - `arc-move`     → grip ON the curve at 1/3 of the sweep, 4-arrow MOVE glyph +
 *                      per-arm directional move-by-value (ADR-397 Φ2) + whole-entity
 *                      translate (existing `movesEntity` path — NO new commit).
 *   - `arc-rotation` → rotation handle ON the curve at 2/3 of the sweep (evenly spaced
 *                      with the MOVE mark + endpoints). Commit routes through the canonical
 *                      `RotateEntityCommand` (pivot = centre) — same as the line.
 *
 * The centre stays a plain whole-move grip (AutoCAD-style square — move / radius
 * reference), and the start/end endpoints stay untagged (standard reshape).
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/grip-glyph-registry.ts — `'arc-move' → 'move'`, `'arc-rotation' → 'rotation'`
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ArcGripKind } from '../../hooks/grip-types';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-rendering-utils';

/** The arc MOVE + ROTATION grip kinds (mirror `line-move` / `line-rotation`). */
export const ARC_MOVE_KIND: ArcGripKind = 'arc-move';
export const ARC_ROTATION_KIND: ArcGripKind = 'arc-rotation';

const DEG_TO_RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/**
 * MOVE + ROTATE handles sit ON the curve at these sweep fractions (start→end), evenly
 * spaced with the two endpoints so BOTH marks land on the arc line itself (Giorgio
 * 2026-07-21: «τα σημάδια περιστροφής και μετακίνησης πάνω στη γραμμή του τόξου»).
 */
const ARC_MOVE_SWEEP_FRACTION = 1 / 3;
const ARC_ROTATION_SWEEP_FRACTION = 2 / 3;

/**
 * Point ON the DRAWN arc curve at `fraction` of the sweep (0 = start … 1 = end),
 * sampled the SAME way `ArcRenderer` draws it so a handle always lands on the VISIBLE
 * curve — NOT the mirrored/opposite arc (Giorgio 2026-07-21: «χρειάζεται MIRROR»).
 *
 * The renderer draws `ctx.arc(-startRad → -endRad, anticlockwise = !counterclockwise)`
 * (Y-inversion: screen angle = −world angle). We replicate that screen sweep — picking
 * the increasing/decreasing wrap the renderer's `anticlockwise` implies — then invert
 * back to a world angle. A naive `start + (end−start)·f` breaks whenever the stored
 * angles are not already ordered for the drawn direction (→ handles jump to the mirror).
 */
function arcSweepPoint(
  center: Point2D, radius: number,
  startAngleDeg: number, endAngleDeg: number,
  counterclockwise: boolean, fraction: number,
): Point2D {
  const sStart = -startAngleDeg * DEG_TO_RAD;
  let sEnd = -endAngleDeg * DEG_TO_RAD;
  if (counterclockwise) {
    // renderer: anticlockwise = false → screen sweeps INCREASING
    while (sEnd <= sStart) sEnd += TAU;
  } else {
    // renderer: anticlockwise = true → screen sweeps DECREASING
    while (sEnd >= sStart) sEnd -= TAU;
  }
  const sAngle = sStart + (sEnd - sStart) * fraction;
  return pointOnCircle(center, radius, -sAngle);
}

/**
 * World position of the arc's rotation handle: ON the DRAWN curve at 2/3 of the sweep, so
 * it sits on the arc line itself (the MOVE glyph takes the 1/3 point) — NOT near the far
 * centre and NOT on the mirror arc (Giorgio 2026-07-21). Pivot stays the centre.
 */
export function arcRotationHandlePos(
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  counterclockwise: boolean = false,
): Point2D {
  return arcSweepPoint(center, radius, startAngleDeg, endAngleDeg, counterclockwise, ARC_ROTATION_SWEEP_FRACTION);
}

/**
 * The 5 grips of a plain DXF arc — the SSoT both grip paths consume:
 *   0 → centre (plain whole-arc translate — AutoCAD-style square, move / radius ref)
 *   1 → start endpoint (edit `startAngle`)
 *   2 → end endpoint (edit `endAngle`)
 *   3 → arc 1/3 point, ON the curve (`'arc-move'` → 4-arrow MOVE glyph + directional prompt + translate)
 *   4 → arc 2/3 point, ON the curve (`'arc-rotation'` → curved glyph + hot-grip rotate + RotateEntityCommand)
 *
 * `type: 'vertex'` on the rotation handle so it is never filtered by the
 * showMidpoints/showCenters preferences (selecting an arc always shows it).
 * Returns the hooks `GripInfo`; the 2D renderer maps each to its render `GripInfo`
 * (+`shape`) — see `ArcRenderer.getGrips`.
 */
export function getArcGrips(
  entityId: string,
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  counterclockwise: boolean = false,
): GripInfo[] {
  const startRad = startAngleDeg * DEG_TO_RAD;
  const endRad = endAngleDeg * DEG_TO_RAD;
  return [
    // 0 → centre: plain whole-arc MOVE grip (AutoCAD-style square). KEPT as a move /
    //     radius reference, but the MOVE glyph now lives on the curve (grip 3) so the
    //     far-from-arc centre no longer carries the 4-arrow affordance.
    { entityId, gripIndex: 0, type: 'center', position: center, movesEntity: true },
    { entityId, gripIndex: 1, type: 'vertex', position: pointOnCircle(center, radius, startRad), movesEntity: false },
    { entityId, gripIndex: 2, type: 'vertex', position: pointOnCircle(center, radius, endRad), movesEntity: false },
    // 3 → arc 1/3 point, ON the drawn curve: the MOVE affordance (4-arrow glyph +
    //     directional move-by-value), on the arc line where the eye is (was the centre).
    {
      entityId, gripIndex: 3, type: 'edge',
      position: arcSweepPoint(center, radius, startAngleDeg, endAngleDeg, counterclockwise, ARC_MOVE_SWEEP_FRACTION),
      movesEntity: true,
      gripKind: { on: 'arc', kind: ARC_MOVE_KIND },
    },
    // 4 → rotation handle: arc 2/3 point, ON the curve (evenly spaced with grip 3 + endpoints).
    {
      entityId, gripIndex: 4, type: 'vertex',
      position: arcRotationHandlePos(center, radius, startAngleDeg, endAngleDeg, counterclockwise), movesEntity: false,
      gripKind: { on: 'arc', kind: ARC_ROTATION_KIND },
    },
  ];
}

// NOTE (ADR-561, 2026-07-05): the live arc ROTATION ghost no longer has a bespoke
// `applyArcRotationDrag` here — it was a verbatim copy of `rotateEntity`'s arc case. The
// ghost now delegates to the shared `applyPrimitiveRotationDrag`
// (`hooks/grips/primitive-rotation-drag.ts`), which runs the SAME `rotateEntity` the commit
// (`RotateEntityCommand`) does. See that module + `rendering/ghost/apply-entity-preview.ts`.
