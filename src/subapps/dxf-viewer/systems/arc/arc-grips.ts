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
 *   - `arc-move`     → arc-MIDPOINT grip, 4-arrow MOVE glyph + per-arm directional
 *                      move-by-value (ADR-397 Φ2) + whole-entity translate
 *                      (existing `movesEntity` path — NO new commit).
 *   - `arc-rotation` → rotation handle radially just OUTSIDE the arc midpoint, on/beside
 *                      the curve. Commit routes through the canonical `RotateEntityCommand`
 *                      (pivot = centre) — same as the line, NO bespoke transform.
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

/** ROTATE handle radial factor: sits just outside the curve at the arc midpoint. */
const ARC_ROTATION_RADIAL_FACTOR = 1.18;

/**
 * World position of the arc's rotation handle: radially just OUTSIDE the arc midpoint
 * (`radius · ARC_ROTATION_RADIAL_FACTOR` along the mid-sweep angle), so it sits ON/beside
 * the visible curve where the user's eye is — NOT near the far centre (Giorgio
 * 2026-07-21). The pivot stays the centre regardless (see grip 4 below).
 */
export function arcRotationHandlePos(
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
): Point2D {
  const midRad = ((startAngleDeg + endAngleDeg) / 2) * DEG_TO_RAD;
  return pointOnCircle(center, radius * ARC_ROTATION_RADIAL_FACTOR, midRad);
}

/**
 * The 5 grips of a plain DXF arc — the SSoT both grip paths consume:
 *   0 → centre (plain whole-arc translate — AutoCAD-style square, move / radius ref)
 *   1 → start endpoint (edit `startAngle`)
 *   2 → end endpoint (edit `endAngle`)
 *   3 → arc midpoint (`'arc-move'` → 4-arrow MOVE glyph + directional prompt + translate)
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
    // 0 → centre: plain whole-arc MOVE grip (AutoCAD-style square). KEPT as a move /
    //     radius reference, but the MOVE glyph now lives on the curve (grip 3) so the
    //     far-from-arc centre no longer carries the 4-arrow affordance.
    { entityId, gripIndex: 0, type: 'center', position: center, movesEntity: true },
    { entityId, gripIndex: 1, type: 'vertex', position: pointOnCircle(center, radius, startRad), movesEntity: false },
    { entityId, gripIndex: 2, type: 'vertex', position: pointOnCircle(center, radius, endRad), movesEntity: false },
    // 3 → arc midpoint: the MOVE affordance (4-arrow glyph + directional move-by-value),
    //     now ON the curve where the eye is (was the centre).
    {
      entityId, gripIndex: 3, type: 'edge',
      position: pointOnCircle(center, radius, midRad), movesEntity: true,
      gripKind: { on: 'arc', kind: ARC_MOVE_KIND },
    },
    // 4 → rotation handle: radially just outside the midpoint, on/beside the curve.
    {
      entityId, gripIndex: 4, type: 'vertex',
      position: arcRotationHandlePos(center, radius, startAngleDeg, endAngleDeg), movesEntity: false,
      gripKind: { on: 'arc', kind: ARC_ROTATION_KIND },
    },
  ];
}

// NOTE (ADR-561, 2026-07-05): the live arc ROTATION ghost no longer has a bespoke
// `applyArcRotationDrag` here — it was a verbatim copy of `rotateEntity`'s arc case. The
// ghost now delegates to the shared `applyPrimitiveRotationDrag`
// (`hooks/grips/primitive-rotation-drag.ts`), which runs the SAME `rotateEntity` the commit
// (`RotateEntityCommand`) does. See that module + `rendering/ghost/apply-entity-preview.ts`.
