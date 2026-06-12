/**
 * Grip-drag step snap (SNAP-MODE / F9) — SSoT for quantizing the 2D grip-drag
 * displacement to a fixed increment.
 *
 * When SNAP-MODE is ON, the displacement of every 2D grip drag (whole-entity
 * move + corner/edge resize + polygon-vertex move) is rounded to the nearest
 * multiple of the user-defined step, so dimension/position changes follow that
 * step (Revit dimension-snap-increment / AutoCAD F9 Snap parity).
 *
 * Two layers:
 *   - `quantizeDeltaToStep(delta, step)` — pure, deterministic, unit-agnostic
 *     (scene units in, scene units out). Trivially testable.
 *   - `applyGripStepSnap(delta)` — thin event-time wrapper that reads the live
 *     SNAP-MODE flag + step from {@link cadToggleState} (the non-React ADR-040
 *     bridge) and delegates to the pure core. Returns the delta unchanged when
 *     SNAP-MODE is OFF or the step is non-positive.
 *
 * Applied at the TWO SSoT delta computations that cover every BIM entity type:
 *   - commit: `hooks/grips/grip-mouse-handlers.ts` (runGripMouseUp)
 *   - preview ghost: `hooks/grips/grip-projections.ts` (buildDxfDragPreview)
 * so the rubber-band ghost and the committed result always agree (WYSIWYG).
 *
 * NOTE (DEFER): for ROTATED entities the delta is quantized in world XY, not in
 * the entity's local frame, so a rotated dimension is not guaranteed to land on
 * a clean step. Local-frame quantization (inside `rect-grip-engine`) is a Phase
 * 2 follow-up.
 *
 * @see systems/constraints/cad-toggle-state.ts — live SNAP-MODE source
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { immediateSceneScale } from '../../systems/cursor/ImmediateSceneScaleStore';
import { QKeyTracker } from '../../keyboard/QKeyTracker';

/** Default SNAP-MODE increment, in **millimetres** (the unit the user types). */
export const DEFAULT_GRIP_SNAP_STEP = 50;

/** Round a scalar to the nearest multiple of `step` (no-op when step ≤ 0). */
export function quantizeValueToStep(value: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
}

/** Round both components of a displacement to the nearest multiple of `step`. */
export function quantizeDeltaToStep(delta: Point2D, step: number): Point2D {
  if (!(step > 0)) return { x: delta.x, y: delta.y };
  return {
    x: quantizeValueToStep(delta.x, step),
    y: quantizeValueToStep(delta.y, step),
  };
}

/**
 * Event-time entry point: quantize a grip-drag displacement to the SNAP-MODE step.
 *
 * Activation model (Giorgio 2026-06-12): movement is FREE by default; the step
 * applies only while **Q is held** during the drag — and only when the SNAP-MODE
 * (F9) toggle is armed (which also reveals the mm value field). Releasing Q (or
 * Q never pressed) → free. No-op (delta verbatim) otherwise.
 *
 * The user-typed step is in **mm**; the drag `delta` is in **scene (canvas)
 * units**. They are only equal on an mm-scale drawing — so we convert the step
 * to scene units via the live mm→scene scale (`immediateSceneScale`). Without
 * this a 50 mm step on a metre-scale drawing (scale 0.001) would quantize a
 * ~metre delta to multiples of 50 → always 0 → the entity would never move.
 */
export function applyGripStepSnap(delta: Point2D): Point2D {
  const snapOn = cadToggleState.isSnapOn();
  const qHeld = QKeyTracker.getSnapshot();
  const stepScene = cadToggleState.getSnapStep() * immediateSceneScale.getMmToScene();
  const result = (!snapOn || !qHeld) ? { x: delta.x, y: delta.y } : quantizeDeltaToStep(delta, stepScene);
  // 🔧 TEMP DEBUG (ADR-363 snap diagnostics — REMOVE after verify). Logs only while
  // SNAP is armed so it doesn't flood. `changed` bisects the bug: if false while
  // qHeld → quantization is a no-op (delta magnitude vs stepScene units mismatch);
  // if true but the entity still moves freely → a downstream path ignores the result.
  if (snapOn) {
    // eslint-disable-next-line no-console
    console.log('[SNAP-Q] applyGripStepSnap', {
      snapOn, qHeld,
      stepMm: cadToggleState.getSnapStep(),
      scale: immediateSceneScale.getMmToScene(),
      stepScene,
      deltaIn: { x: delta.x, y: delta.y },
      deltaOut: { x: result.x, y: result.y },
      changed: result.x !== delta.x || result.y !== delta.y,
    });
  }
  return result;
}
