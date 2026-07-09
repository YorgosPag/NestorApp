/**
 * ADR-583 Φ2.4 — Graphic scale-bar grip SSoT (pure helpers).
 *
 * The SINGLE source both grip paths consume so they can never diverge (mirror
 * `bim/annotation-symbols/annotation-symbol-grips.ts` ↔ its renderer):
 *   - `computeDxfEntityGrips` (GRIP_PRODUCERS['scale-bar']) → interaction + hit-testing.
 *   - `ScaleBarRenderer.getGrips`                          → on-canvas 2D grip painting.
 *
 * Three grips, ALL positioned from the DERIVED geometry (`computeScaleBarGeometry`) —
 * never from raw params — so the handles track the real span (grip positions read from
 * geometry, ADR-587):
 *   0 → MOVE cross @ axis midpoint (`'scale-bar-move'`, `movesEntity` → whole-entity
 *       translate of `position`; the 4-arrow MOVE glyph via `grip-glyph-registry`).
 *   1 → ROTATION handle @ perpendicular offset below the '0' tick (`'scale-bar-rotation'`,
 *       curved glyph). Placement mirrors the annotation-symbol / column rotation handle
 *       (`rotationHandleMidwayOffset` + `rotatePoint`). Drag writes `angleRad` ONLY.
 *   2 → LENGTH handle @ the derived `endPosition` (`'scale-bar-length'`). Drag recomputes
 *       `angleRad` + snapped `length` via the shared `deriveScaleBarAxis` SSoT; the
 *       `endPosition` stays DERIVED (never stored).
 *
 * The commit / ghost drag math lives in {@link applyScaleBarGripDrag} (the SAME helper the
 * parametric commit + the live ghost run → preview ≡ commit by identity).
 *
 * @see bim/annotation-symbols/annotation-symbol-grips.ts — the move+rotation template
 * @see bim/scale-bar/build-scale-bar-entity.ts — `deriveScaleBarAxis` (span SSoT)
 * @see bim/geometry/scale-bar-geometry.ts — `computeScaleBarGeometry` (derived cache)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ScaleBarGripKind } from '../../hooks/grip-types';
import type { ScaleBarEntity } from '../../types/scale-bar';
import { computeScaleBarGeometry } from '../geometry/scale-bar-geometry';
import { deriveScaleBarAxis } from './build-scale-bar-entity';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotatePoint } from '../../utils/rotation-math';
import { rotationHandleMidwayOffset } from '../grips/rotation-handle-policy';

/** The scale-bar grip kinds (distinct literals routed by `PARAMETRIC_COMMIT_HANDLERS`). */
export const SCALE_BAR_MOVE_KIND: ScaleBarGripKind = 'scale-bar-move';
export const SCALE_BAR_ROTATION_KIND: ScaleBarGripKind = 'scale-bar-rotation';
export const SCALE_BAR_LENGTH_KIND: ScaleBarGripKind = 'scale-bar-length';

/**
 * World position of the rotation handle: below the '0' tick (local −Y, midway offset
 * of the model span) rotated by the bar's own `angleRad` so it always sits perpendicular
 * to the axis. Reuses the `rotationHandleMidwayOffset` + `rotatePoint` SSoT (annotation-
 * symbol / column parity). Purely visual — the drag math (swept angle) is placement-agnostic.
 */
export function scaleBarRotationHandlePos(
  position: Point2D,
  totalModelLengthMm: number,
  angleRad: number,
): Point2D {
  const offY = rotationHandleMidwayOffset(totalModelLengthMm); // negative (convex) ⇒ −span/4
  return rotatePoint(
    { x: position.x, y: position.y + offY },
    position,
    (angleRad * 180) / Math.PI,
  );
}

/**
 * The 3 grips of a scale bar — the SSoT both grip paths consume. Positions derive from
 * `computeScaleBarGeometry`; the span is scale-invariant so `drawingScale`/`sceneUnits`
 * do not affect grip positions (called with the canonical `(1, 'mm')`).
 */
export function getScaleBarGrips(entity: ScaleBarEntity): GripInfo[] {
  const geo = computeScaleBarGeometry(entity, 1, 'mm');
  return [
    {
      entityId: entity.id, gripIndex: 0, type: 'center',
      position: calculateMidpoint(entity.position, geo.endPosition), movesEntity: true,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_MOVE_KIND },
    },
    {
      entityId: entity.id, gripIndex: 1, type: 'vertex',
      position: scaleBarRotationHandlePos(entity.position, geo.totalModelLengthMm, entity.angleRad),
      movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_ROTATION_KIND },
    },
    {
      entityId: entity.id, gripIndex: 2, type: 'vertex',
      position: geo.endPosition, movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_LENGTH_KIND },
    },
  ];
}

/**
 * Pure drag transform — the params patch for a scale-bar grip drag (the SSoT the commit
 * AND the live ghost both run, so preview ≡ commit by identity). `gripWorldPos` = the
 * grabbed grip's world anchor; `delta` = the cursor displacement.
 *   - move     → translate the whole bar (`position += delta`).
 *   - rotation → swept angle about `position` (placement-agnostic: the angle CHANGE of the
 *                dragged handle, no-op at zero delta) → `angleRad` only.
 *   - length   → the far point follows the cursor → recompute `angleRad` + snapped `length`
 *                via the shared `deriveScaleBarAxis` (the SAME formula creation uses).
 * The DERIVED `geometry` cache is never written — it is recomputed on the next render.
 */
export function applyScaleBarGripDrag(
  kind: ScaleBarGripKind,
  entity: ScaleBarEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
): Partial<ScaleBarEntity> {
  switch (kind) {
    case 'scale-bar-move':
      return { position: translatePoint(entity.position, delta) };
    case 'scale-bar-rotation': {
      const { position } = entity;
      const initAngle = Math.atan2(gripWorldPos.y - position.y, gripWorldPos.x - position.x);
      const newHandle = translatePoint(gripWorldPos, delta);
      const newAngle = Math.atan2(newHandle.y - position.y, newHandle.x - position.x);
      return { angleRad: entity.angleRad + (newAngle - initAngle) };
    }
    case 'scale-bar-length':
      return deriveScaleBarAxis(entity.position, translatePoint(gripWorldPos, delta), entity.unit);
  }
}
