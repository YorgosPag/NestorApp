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
 * step** (F9 increment quantize). `applyMoveConstraints` composes both so the
 * preview ghost and the commit run the identical transform (WYSIWYG).
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
import { applyGripStepSnap } from './grip-step-quantize';

/** Origin reference for ortho-on-a-delta (constrain the displacement itself). */
const DELTA_ORIGIN: Point2D = { x: 0, y: 0 };

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
 * (F9) step quantize. Use this at every MOVE chokepoint (preview + commit) so the
 * ghost and the committed translation always agree.
 */
export function applyMoveConstraints(delta: Point2D): Point2D {
  return applyGripStepSnap(applyOrthoToDelta(delta));
}
