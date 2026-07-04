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
 * ORTHO covers BOTH constraint families (AutoCAD/Revit parity — F8 locks a grip
 * STRETCH exactly as it locks a move):
 *   - whole-entity MOVE → {@link applyMoveConstraints} (ORTHO ⊕ F9 step ⊕ Shift fine);
 *   - parametric RESIZE grip (wall thickness, corner/edge reshape, slab vertex, …) →
 *     {@link applyResizeConstraints} (ORTHO ⊕ F9 step, NO Shift fine — see below).
 * The axis-lock is on the WORLD drag delta (the current UCS), so a rotated entity's
 * grip locks to world H/V just like AutoCAD (local-frame lock = separate refinement).
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
import { applyGripStepSnap, quantizeDeltaToStep, quantizeValueToStep, activeStepSceneUnits } from './grip-step-quantize';
import { immediateSceneScale } from '../../systems/cursor/ImmediateSceneScaleStore';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
// ADR-363 §line local-ortho — ο τοπικός άξονας μιας λοξής γραμμής κατά τη μετακίνηση μέσου/MOVE-cross.
import { getMoveOrthoAxis } from '../../systems/grip/MoveOrthoAxisStore';

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
 * Point form of {@link applyMoveFineStep}: quantize `point` to the Shift fine 1 cm
 * step measured RELATIVE to `anchor` (so the displacement `point − anchor` lands on
 * clean 1 cm multiples — Option Α, step of the move). No-op (point verbatim) when
 * Shift is up. Used by the wall-draw endpoint so a freely-placed end grows in 1 cm
 * increments from the start point — same SSoT math as the grip move.
 */
export function applyMoveFineStepAboutAnchor(point: Point2D, anchor: Point2D): Point2D {
  const d = applyMoveFineStep({ x: point.x - anchor.x, y: point.y - anchor.y });
  return { x: anchor.x + d.x, y: anchor.y + d.y };
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
 * ADR-363 §line local-ortho — ORTHO πάνω σε whole-entity move όταν είναι ενεργό το ΤΟΠΙΚΟ
 * πλαίσιο άξονα (σύρσιμο μέσου / MOVE-cross λοξής γραμμής, `MoveOrthoAxisStore`): κλείδωσε τη
 * μετατόπιση στον ΔΙΚΟ ΤΗΣ άξονα (∥ û) Ή στην κάθετή του (⟂ n̂) — νικά η μεγαλύτερη προβολή
 * (τοπικό `hardOrtho`). Ύστερα το F9 SNAP-MODE step + το Shift fine step κβαντίζουν τη ΒΑΘΜΩΤΗ
 * απόσταση ΚΑΤΑ ΜΗΚΟΣ του locked άξονα (όχι world X/Y), ώστε μια λοξή μετατόπιση να πέφτει σε
 * καθαρά βήματα. Reuse των ΙΔΙΩΝ activation gates + mm→scene SSoT με το world path — μηδέν νέα
 * μηχανή βήματος. (Giorgio 2026-07-04 «κάθετα/παράλληλα στον άξονα, με βήμα πάνω στη διεύθυνση».)
 */
export function applyLocalOrthoMove(delta: Point2D, u: Point2D): Point2D {
  const n: Point2D = { x: -u.y, y: u.x };        // μοναδιαία κάθετη
  const along = delta.x * u.x + delta.y * u.y;   // ∥ προβολή
  const perp = delta.x * n.x + delta.y * n.y;    // ⟂ προβολή
  const useAlong = Math.abs(along) >= Math.abs(perp);
  const axis = useAlong ? u : n;
  let s = useAlong ? along : perp;
  // F9 SNAP-MODE step ΚΑΤΑ ΜΗΚΟΣ του locked άξονα (scalar quantize), μετά Shift fine step.
  const stepScene = activeStepSceneUnits();
  if (stepScene > 0) s = quantizeValueToStep(s, stepScene);
  if (isMoveFineStepActive()) {
    s = quantizeValueToStep(s, MOVE_FINE_STEP_MM * immediateSceneScale.getMmToScene());
  }
  return { x: axis.x * s, y: axis.y * s };
}

/**
 * Full whole-entity-move pipeline: ORTHO (F8) axis-lock first, then SNAP-MODE
 * (F9) step quantize, then the Shift fine 1 cm step. Use this at every MOVE
 * chokepoint (preview + commit) so the ghost and the committed translation always
 * agree. The fine step runs last so a held Shift has final say over the
 * increment; on an mm-scale grid 10 mm divides the usual F9 steps, so the two
 * never fight when both are engaged.
 *
 * ADR-363 §line local-ortho — όταν το `MoveOrthoAxisStore` έχει άξονα (σύρσιμο μέσου/MOVE-cross
 * λοξής γραμμής) ΚΑΙ το ORTHO είναι armed, το lock γίνεται στο ΤΟΠΙΚΟ πλαίσιο της γραμμής μέσω
 * `applyLocalOrthoMove`. Χωρίς άξονα → world H/V (αμετάβλητη συμπεριφορά — μηδέν regression).
 */
export function applyMoveConstraints(delta: Point2D): Point2D {
  const axis = getMoveOrthoAxis();
  if (axis && cadToggleState.isOrthoOn()) return applyLocalOrthoMove(delta, axis);
  return applyMoveFineStep(applyGripStepSnap(applyOrthoToDelta(delta)));
}

/**
 * Parametric RESIZE-grip pipeline: ORTHO (F8) axis-lock first, then the SNAP-MODE
 * (F9) step quantize. AutoCAD/Revit parity — dragging a corner/edge/vertex reshape
 * grip with ORTHO armed locks the stretch to the world H/V axis, exactly as ORTHO
 * locks a whole-entity move. The lock is on the WORLD delta (UCS behaviour), so a
 * rotated entity's grip still locks to world H/V (same as AutoCAD).
 *
 * OMITS the Shift fine 1 cm step that {@link applyMoveConstraints} adds: for a resize
 * grip Shift already carries a rectilinear-constraint meaning (`ShiftKeyTracker`
 * consumers), so the move-increment must not hijack it. No-op vs the previous
 * behaviour when ORTHO is OFF (`applyOrthoToDelta` returns the delta verbatim) →
 * free reshape by default, axis-locked only while F8 is armed. Shared by the grip
 * preview ghost + commit so ghost == result (WYSIWYG).
 */
export function applyResizeConstraints(delta: Point2D): Point2D {
  return applyGripStepSnap(applyOrthoToDelta(delta));
}
