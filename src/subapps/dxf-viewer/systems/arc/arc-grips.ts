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
      position: center, movesEntity: true,
      gripKind: { on: 'arc', kind: ARC_MOVE_KIND },
    },
    { entityId, gripIndex: 1, type: 'vertex', position: pointOnCircle(center, radius, startRad), movesEntity: false },
    { entityId, gripIndex: 2, type: 'vertex', position: pointOnCircle(center, radius, endRad), movesEntity: false },
    { entityId, gripIndex: 3, type: 'edge', position: pointOnCircle(center, radius, midRad), movesEntity: true },
    {
      entityId, gripIndex: 4, type: 'vertex',
      position: arcRotationHandlePos(center, radius), movesEntity: false,
      gripKind: { on: 'arc', kind: ARC_ROTATION_KIND },
    },
  ];
}

// NOTE (ADR-561, 2026-07-05): the live arc ROTATION ghost no longer has a bespoke
// `applyArcRotationDrag` here — it was a verbatim copy of `rotateEntity`'s arc case. The
// ghost now delegates to the shared `applyPrimitiveRotationDrag`
// (`hooks/grips/primitive-rotation-drag.ts`), which runs the SAME `rotateEntity` the commit
// (`RotateEntityCommand`) does. See that module + `rendering/ghost/apply-entity-preview.ts`.
