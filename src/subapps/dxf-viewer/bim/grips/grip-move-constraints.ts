/**
 * Grip whole-entity-MOVE constraints — SSoT for ORTHO (F8) on a 2D move drag.
 *
 * AutoCAD/Revit parity: while ORTHO is armed, dragging an entity (or any grip
 * flagged `movesEntity` / an Alt move-from-base-point / a wall "move" hot-grip)
 * locks the displacement to the horizontal **or** vertical axis. The lock is
 * applied to the drag *delta* — constraining the delta relative to the origin is
 * identical to constraining the cursor relative to the move base point, so this
 * stays a pure, anchor-agnostic transform.
 *
 * This module deliberately covers **only the whole-entity move** paths. Parametric
 * resize grips (wall thickness, corner reshape, slab vertex, …) interpret their
 * delta in entity-local terms and must NOT be axis-locked here — they keep the
 * plain {@link applyGripStepSnap} step quantization.
 *
 * Pipeline order matches AutoCAD: **ORTHO first** (axis lock), **then SNAP-MODE
 * step** (F9 increment quantize), **then the Shift fine step** (a fixed 1 cm
 * move-increment, Giorgio 2026-06-24). `applyMoveConstraints` composes all three
 * so the preview ghost and the commit run the identical transform (WYSIWYG).
 *
 * The **Shift fine step** quantizes the move DELTA to multiples of 1 cm while
 * Shift is held — Revit «move snap increment». It lives here (whole-entity move
 * only) and NOT in {@link applyGripStepSnap} because that SSoT is shared with
 * parametric resize grips, where Shift already means rectilinear constraint
 * (`ShiftKeyTracker` consumers). Reuses the step-quantize core + the mm→scene
 * SSoT — no new rounding helper, no hardcoded unit factor.
 *
 * Reads the live ORTHO flag from {@link cadToggleState} (the non-React ADR-040
 * event-time bridge) — same SSoT the drawing path's `hardOrtho` consults via
 * `useCadToggles`. No-op (delta verbatim) when ORTHO is OFF.
 *
 * Applied at the SSoT move-delta chokepoints (whole-entity move only):
 *   - grip-drag preview: `hooks/grips/grip-projections.ts` (buildDxfDragPreview)
 *   - grip-drag commit:  `hooks/grips/grip-mouse-handlers.ts` (runGripMouseUp)
 *   - Move tool (AutoCAD MOVE, base→destination) — `applyOrthoToDelta` only (the
 *     click-click Move tool is not a grip drag, so it skips the F9 Q-step layer):
 *     `hooks/tools/useMoveTool.ts` (commit) + `useMovePreview.ts` (ghost/rubber-band).
 *
 * @see bim/grips/grip-step-quantize.ts — the SNAP-MODE step SSoT this composes
 * @see hooks/drawing/drawing-handler-utils.ts — the `hardOrtho` axis-lock SSoT
 * @see systems/constraints/cad-toggle-state.ts — live ORTHO (F8) source
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { hardOrtho } from '../../hooks/drawing/drawing-handler-utils';
import { applyGripStepSnap, quantizeDeltaToStep } from './grip-step-quantize';
import { immediateSceneScale } from '../../systems/cursor/ImmediateSceneScaleStore';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';

/** Origin reference for ortho-on-a-delta (constrain the displacement itself). */
const DELTA_ORIGIN: Point2D = { x: 0, y: 0 };

/** Shift fine-move increment, in **millimetres** (1 cm — Giorgio 2026-06-24). */
export const MOVE_FINE_STEP_MM = 10;

/**
 * Live activation predicate for the Shift fine-move step — SSoT for "is the 1 cm
 * move increment currently engaged". True only while Shift is held. The ghost
 * ({@link applyMoveConstraints} in the preview) and the commit both gate on this
 * via {@link applyMoveFineStep}, so they engage/disengage in lockstep.
 */
export function isMoveFineStepActive(): boolean {
  return ShiftKeyTracker.getSnapshot();
}

/**
 * Quantize a whole-entity move displacement to the fixed 1 cm step while Shift is
 * held. The step is in mm (the unit the user thinks in); the `delta` is in scene
 * units, so it is converted via the live mm→scene SSoT (`immediateSceneScale`),
 * exactly like {@link applyGripStepSnap}. No-op (delta verbatim) when Shift is up.
 */
export function applyMoveFineStep(delta: Point2D): Point2D {
  if (!isMoveFineStepActive()) return { x: delta.x, y: delta.y };
  const stepScene = MOVE_FINE_STEP_MM * immediateSceneScale.getMmToScene();
  return quantizeDeltaToStep(delta, stepScene);
}

/**
 * ORTHO (F8) for a whole-entity move displacement: locks the delta to the H or V
 * axis (the larger component wins, AutoCAD-style). No-op when ORTHO is OFF.
 */
export function applyOrthoToDelta(delta: Point2D): Point2D {
  if (!cadToggleState.isOrthoOn()) return { x: delta.x, y: delta.y };
  return hardOrtho(delta, DELTA_ORIGIN);
}

/**
 * Full whole-entity-move pipeline: ORTHO (F8) axis-lock first, then SNAP-MODE
 * (F9) step quantize, then the Shift fine 1 cm step. Use this at every MOVE
 * chokepoint (preview + commit) so the ghost and the committed translation always
 * agree. The fine step runs last so a held Shift has final say over the
 * increment; on an mm-scale grid 10 mm divides the usual F9 steps, so the two
 * never fight when both are engaged.
 */
export function applyMoveConstraints(delta: Point2D): Point2D {
  return applyMoveFineStep(applyGripStepSnap(applyOrthoToDelta(delta)));
}
