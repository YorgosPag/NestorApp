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
 * gets BOTH a move cross AND a rotation handle:
 *   - `arc-move`     → centre grip, 4-arrow MOVE glyph + per-arm directional
 *                      move-by-value (ADR-397 Φ2) + whole-entity translate
 *                      (existing `movesEntity` path — NO new commit).
 *   - `arc-rotation` → rotation handle midway between the centre and the (nominal)
 *                      bottom, via the SHARED `rotationHandleMidwayOffset` policy
 *                      (parity με column/text placement). Commit routes through the
 *                      canonical `RotateEntityCommand` (pivot = centre) — same as
 *                      the line, NO bespoke transform.
 *
 * The start/end endpoints + the arc midpoint stay untagged (standard reshape /
 * whole-move), exactly as before.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/rotation-handle-policy.ts — `rotationHandleMidwayOffset` (shared)
 * @see bim/grips/grip-glyph-registry.ts — `'arc-move' → 'move'`, `'arc-rotation' → 'rotation'`
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ArcGripKind } from '../../hooks/grip-types';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-rendering-utils';
import { rotationHandleMidwayOffset } from '../../bim/grips/rotation-handle-policy';
// ADR-561 — live arc ROTATION ghost SSoT: the SAME swept-angle + rotate primitives the
// commit runs (`commitArcGripDrag` → `resolveRotation` → `RotateEntityCommand`), so
// preview ≡ commit by construction (μηδέν νέα rotate math — mirror `applyLineRotationDrag`).
import { sweptAngleDegAboutPivot } from '../../bim/grips/grip-math';
import { rotatePoint } from '../../utils/rotation-math';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-utils';

/** The arc MOVE + ROTATION grip kinds (mirror `line-move` / `line-rotation`). */
export const ARC_MOVE_KIND: ArcGripKind = 'arc-move';
export const ARC_ROTATION_KIND: ArcGripKind = 'arc-rotation';

const DEG_TO_RAD = Math.PI / 180;

/**
 * World position of the arc's rotation handle: midway between the centre and the
 * nominal bottom edge, via the SAME `rotationHandleMidwayOffset` policy the column
 * / text use (`−dimY/4` with `dimY = 2·radius` ⇒ `−radius/2`). Sits INSIDE the arc
 * disc, visually distinct from the centre MOVE cross. World-down (local −Y) because
 * an arc carries no rectangular frame — the pivot is the centre regardless.
 */
export function arcRotationHandlePos(center: Point2D, radius: number): Point2D {
  const offY = rotationHandleMidwayOffset(radius * 2); // negative (convex) ⇒ −radius/2
  return { x: center.x, y: center.y + offY };
}

/**
 * The 5 grips of a plain DXF arc — the SSoT both grip paths consume:
 *   0 → centre (whole-arc translate; `'arc-move'` → 4-arrow MOVE glyph + directional prompt)
 *   1 → start endpoint (edit `startAngle`)
 *   2 → end endpoint (edit `endAngle`)
 *   3 → arc midpoint (whole-arc translate — kept as before)
 *   4 → rotation handle (`'arc-rotation'` → curved glyph + hot-grip rotate + RotateEntityCommand)
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
): GripInfo[] {
  const startRad = startAngleDeg * DEG_TO_RAD;
  const endRad = endAngleDeg * DEG_TO_RAD;
  const midRad = (startRad + endRad) / 2;
  return [
    {
      entityId, gripIndex: 0, type: 'center',
      position: center, movesEntity: true, arcGripKind: ARC_MOVE_KIND,
    },
    { entityId, gripIndex: 1, type: 'vertex', position: pointOnCircle(center, radius, startRad), movesEntity: false },
    { entityId, gripIndex: 2, type: 'vertex', position: pointOnCircle(center, radius, endRad), movesEntity: false },
    { entityId, gripIndex: 3, type: 'edge', position: pointOnCircle(center, radius, midRad), movesEntity: true },
    {
      entityId, gripIndex: 4, type: 'vertex',
      position: arcRotationHandlePos(center, radius), movesEntity: false, arcGripKind: ARC_ROTATION_KIND,
    },
  ];
}

/** The minimal arc geometry the rotation ghost reads + returns (mirror `applyLineRotationDrag`). */
export interface ArcRotationDragInput {
  readonly center: Point2D;
  readonly startAngleDeg: number;
  readonly endAngleDeg: number;
  /** Reference anchor at mouseDown — the swept angle is anchor-relative (`angle(cur) − angle(anchor)`). */
  readonly anchor: Point2D;
  /** Live world cursor position (= anchor + delta). */
  readonly currentPos: Point2D;
  /** Rotation centre. Absent → the arc's own centre (AutoCAD ROTATE default = arc centre). */
  readonly pivot?: Point2D;
}

/** The rotated arc geometry patch (centre spun about the pivot + start/end angles offset by the sweep). */
export interface ArcRotationDragResult {
  readonly center: Point2D;
  readonly startAngle: number;
  readonly endAngle: number;
}

/**
 * ADR-561 — rotate the arc about the pivot (or its own centre) by the anchor-relative swept angle.
 * Thin adapter over the EXACT rotate primitives the commit runs (`commitArcGripDrag` →
 * `resolveRotation` → `RotateEntityCommand`): `sweptAngleDegAboutPivot` for the angle, then
 * `rotatePoint` the centre + `normalizeAngleDeg` the start/end angles — identical to the arc branch
 * of `rotateEntity` (rotation-math). So the live ghost ≡ the committed result by construction (NO
 * re-implemented rotate math here — one engine, mirror `applyLineRotationDrag`). Returns `null` for a
 * degenerate / zero sweep (cursor on the pivot) so callers no-op.
 */
export function applyArcRotationDrag(input: ArcRotationDragInput): ArcRotationDragResult | null {
  const pivot = input.pivot ?? input.center;
  const sweptDeg = sweptAngleDegAboutPivot(pivot, input.anchor, input.currentPos);
  if (sweptDeg === null || sweptDeg === 0) return null;
  return {
    center: rotatePoint(input.center, pivot, sweptDeg),
    startAngle: normalizeAngleDeg(input.startAngleDeg + sweptDeg),
    endAngle: normalizeAngleDeg(input.endAngleDeg + sweptDeg),
  };
}
