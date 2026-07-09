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
 *   1 → ROTATION handle @ the ¼-point of the axis, ON the baseline (`'scale-bar-rotation'`) —
 *       the midpoint between the MOVE cross (axis centre) and the LEFT length handle
 *       (`position`), i.e. `position + ¼·(endPosition − position)`. On-axis so it sits right on
 *       the line through the two length handles + the move cross (Giorgio 2026-07-09). Drag opts
 *       into the shared hot-grip rotate flow (Φ3c): the bar orbits a picked centre.
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
import { DEFAULT_SCALE_BAR_HEIGHT_MM } from '../../types/scale-bar';
import { computeScaleBarGeometry } from '../geometry/scale-bar-geometry';
import { deriveScaleBarAxis } from './build-scale-bar-entity';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateEntityGripDrag } from '../grips/grip-math';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';

/** The scale-bar grip kinds (distinct literals routed by `PARAMETRIC_COMMIT_HANDLERS`). */
export const SCALE_BAR_MOVE_KIND: ScaleBarGripKind = 'scale-bar-move';
export const SCALE_BAR_ROTATION_KIND: ScaleBarGripKind = 'scale-bar-rotation';
export const SCALE_BAR_LENGTH_KIND: ScaleBarGripKind = 'scale-bar-length';
// ADR-583 Φ2 (Giorgio 2026-07-09 «έξυπνες λαβές») — the LEFT-end length handle + the top-edge
// height handle. Both render the default 'square' glyph (absent from `grip-glyph-registry`) and
// are `type:'vertex'` → always shown on a selected bar (survive grip-type toggles + multi-select).
export const SCALE_BAR_LENGTH_START_KIND: ScaleBarGripKind = 'scale-bar-length-start';
export const SCALE_BAR_HEIGHT_KIND: ScaleBarGripKind = 'scale-bar-height';

/** Minimum annotative bar thickness (paper mm) — the height drag clamps to this. */
const MIN_SCALE_BAR_HEIGHT_MM = 0.5;

/**
 * The 3 grips of a scale bar — the SSoT both grip paths consume. Positions derive from
 * `computeScaleBarGeometry`; the span is scale-invariant so `drawingScale`/`sceneUnits`
 * do not affect grip positions (called with the canonical `(1, 'mm')`).
 */
export function getScaleBarGrips(entity: ScaleBarEntity): GripInfo[] {
  const geo = computeScaleBarGeometry(entity, 1, 'mm');
  const midpoint = calculateMidpoint(entity.position, geo.endPosition);

  // Height handle sits at the TOP-edge midpoint: perp offset = the LIVE annotative thickness
  // (paper mm → model), the SAME fold the renderer draws (`annotationSymbolModelSizeLive`
  // parity — frame-time `drawingScale` getter, ADR-040; `sceneUnits='mm'` since the canvas is
  // canonical-mm). Both the render (`ScaleBarRenderer.getGrips`) and the hit-test producer read
  // THIS SSoT, so visible ≡ pickable. `perp` = +90° CCW of the axis (matches the renderer frame).
  const thicknessModel = paperHeightToModel(
    entity.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM,
    useDrawingScaleStore.getState().drawingScale,
    'mm',
  );
  const perpX = -Math.sin(entity.angleRad);
  const perpY = Math.cos(entity.angleRad);

  return [
    {
      entityId: entity.id, gripIndex: 0, type: 'center',
      position: midpoint, movesEntity: true,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_MOVE_KIND },
    },
    // ROTATION handle @ the ¼-point of the axis — ON the baseline (the line through the two
    // length handles + the move cross), at the midpoint between the move cross (`midpoint`, the
    // axis centre) and the LEFT length handle (`entity.position`). Giorgio 2026-07-09: «να πέφτει
    // πάνω στην ευθεία, στο μέσον του σημαδιού μετακίνησης και της αριστερής λαβής».
    {
      entityId: entity.id, gripIndex: 1, type: 'vertex',
      position: calculateMidpoint(midpoint, entity.position),
      movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_ROTATION_KIND },
    },
    {
      entityId: entity.id, gripIndex: 2, type: 'vertex',
      position: geo.endPosition, movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_LENGTH_KIND },
    },
    // LEFT-end length handle @ the '0' tick (`position`); drag keeps the far end fixed.
    {
      entityId: entity.id, gripIndex: 3, type: 'vertex',
      position: entity.position, movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_LENGTH_START_KIND },
    },
    // Height handle @ the top-edge midpoint; drag rescales the annotative `barHeightMm`.
    {
      entityId: entity.id, gripIndex: 4, type: 'vertex',
      position: { x: midpoint.x + perpX * thicknessModel, y: midpoint.y + perpY * thicknessModel },
      movesEntity: false,
      gripKind: { on: 'scale-bar', kind: SCALE_BAR_HEIGHT_KIND },
    },
  ];
}

/**
 * Pure drag transform — the params patch for a scale-bar grip drag (the SSoT the commit
 * AND the live ghost both run, so preview ≡ commit by identity). `gripWorldPos` = the
 * grabbed grip's world anchor; `delta` = the cursor displacement.
 *   - move     → translate the whole bar (`position += delta`).
 *   - rotation → ADR-583 Φ3 (Giorgio 2026-07-09 «όπως τα άλλα»): when a rotation centre is
 *                picked (hot-grip flow → `rotate` ctx), the bar ORBITS that pivot — BOTH
 *                `position` and `angleRad` sweep by the same angle via the shared
 *                `sweptAngleDegAboutPivot` SSoT (parity με arc/annotation-symbol). With no picked
 *                centre (`rotate` absent) it falls back to the legacy swept angle about the bar's
 *                own origin (`position`), placement-agnostic, no-op at zero delta → `angleRad` only.
 *   - length   → the far point follows the cursor → recompute `angleRad` + snapped `length`
 *                via the shared `deriveScaleBarAxis` (the SAME formula creation uses).
 * The DERIVED `geometry` cache is never written — it is recomputed on the next render.
 */
export function applyScaleBarGripDrag(
  kind: ScaleBarGripKind,
  entity: ScaleBarEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
  rotate?: { readonly pivot: Point2D; readonly anchor: Point2D },
): Partial<ScaleBarEntity> {
  switch (kind) {
    case 'scale-bar-move':
      return { position: translatePoint(entity.position, delta) };
    case 'scale-bar-rotation':
      // ADR-583 Φ3 (Giorgio 2026-07-09 «όπως τα άλλα») — hot-grip orbit about a picked centre,
      // else legacy own-origin spin. Shared with opening-info-tag via the `rotateEntityGripDrag`
      // SSoT (N.18) so the two annotation rotations can never diverge.
      return rotateEntityGripDrag(entity, gripWorldPos, delta, rotate);
    case 'scale-bar-length':
      return deriveScaleBarAxis(entity.position, translatePoint(gripWorldPos, delta), entity.unit);
    case 'scale-bar-length-start': {
      // Drag the '0'-tick origin; keep the FAR end fixed → rederive the axis from the moved
      // origin to the (unchanged) derived far point. `position` moves; `angleRad`/`length`
      // rebuild through the SAME `deriveScaleBarAxis` SSoT (reverse direction of the far handle,
      // same 1-2-5 snap). The far point is recomputed as DERIVED on the next render.
      const far = computeScaleBarGeometry(entity, 1, 'mm').endPosition;
      const newOrigin = translatePoint(gripWorldPos, delta);
      return { position: newOrigin, ...deriveScaleBarAxis(newOrigin, far, entity.unit) };
    }
    case 'scale-bar-height': {
      // Annotative thickness resize via a SCALE-FREE ratio: the drawingScale/sceneUnits factor
      // cancels in `newPerp/oldPerp`, so this stays pure (no store read). `perp` = axis normal
      // (+90° CCW); `oldPerp` = the handle's perpendicular distance from the baseline (= the live
      // model thickness), `newPerp` = after the cursor delta. Clamps to a readable minimum.
      const perpX = -Math.sin(entity.angleRad);
      const perpY = Math.cos(entity.angleRad);
      const oldPerp = (gripWorldPos.x - entity.position.x) * perpX + (gripWorldPos.y - entity.position.y) * perpY;
      if (oldPerp <= 1e-6) return {};
      const newPerp = oldPerp + (delta.x * perpX + delta.y * perpY);
      return { barHeightMm: Math.max((entity.barHeightMm * newPerp) / oldPerp, MIN_SCALE_BAR_HEIGHT_MM) };
    }
  }
}
