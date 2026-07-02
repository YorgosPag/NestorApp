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
// ADR-363 — the ALONG-AXIS step (drawing) reuses the SAME ray-quantization SSoT the
// zoom-adaptive wall step uses, so the fixed step "grows the length" identically.
import { quantizePointFromAnchor } from '../../systems/tracking/adaptive-distance-snap';

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
 * Live activation predicate for the grip-drag step snap — SSoT for "is the step
 * grid currently engaged". True only while the SNAP-MODE (F9) toggle is armed AND
 * Q is held (the activation model below). The ghost quantization (`applyGripStepSnap`)
 * and the crosshair snap-to-grid (`mouse-handler-move.ts`) both gate on this, so they
 * engage/disengage in lockstep and never disagree.
 */
export function isGripStepActive(): boolean {
  return cadToggleState.isSnapOn() && QKeyTracker.getSnapshot();
}

/**
 * Live SNAP-MODE step in **scene units**, or `0` when the step is not engaged (F9 off OR Q not held).
 * SSoT for "the fixed step, in the drawing's units, right now" — the user-typed mm step converted via
 * the live mm→scene scale, gated by the SAME {@link isGripStepActive} activation. Consumers that need
 * the raw magnitude (e.g. the neighbor-clearance gap quantizer) read this instead of re-deriving
 * `getSnapStep() * getMmToScene()` and re-checking the gate. Returns 0 → caller skips quantization.
 */
export function activeStepSceneUnits(): number {
  if (!isGripStepActive()) return 0;
  return cadToggleState.getSnapStep() * immediateSceneScale.getMmToScene();
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
  const stepScene = cadToggleState.getSnapStep() * immediateSceneScale.getMmToScene();
  const result = !isGripStepActive() ? { x: delta.x, y: delta.y } : quantizeDeltaToStep(delta, stepScene);
  return result;
}

/**
 * Anchor-relative POINT variant of the SNAP-MODE step (ADR-363) — quantize a
 * resolved point so its displacement from `anchor` lands on the fixed step grid,
 * returning the snapped POINT (not the delta). Delegates to {@link applyGripStepSnap}
 * verbatim (SAME F9 + Q-held activation, SAME mm→scene scale, SAME rectangular
 * quantization) → ONE step SSoT, zero duplicate rounding logic.
 *
 * Returns `point` unchanged when SNAP-MODE (F9) is OFF or Q is not held, so movement
 * is free by default and "clicks" onto the step grid only while Q is held.
 *
 * Used wherever a point must ride the step grid relative to a fixed anchor:
 *   - the grip-drag CROSSHAIR (`mouse-handler-move`), anchored at the drag start,
 *   - the BIM drawing ghost — preview (`drawing-hover-handler`) AND commit
 *     (`applyBimDrawingConstraint`), anchored at the previous point — so the
 *     rubber-band equals the committed geometry (WYSIWYG).
 */
export function applyPointStepSnap(point: Point2D, anchor: Point2D): Point2D {
  const d = applyGripStepSnap({ x: point.x - anchor.x, y: point.y - anchor.y });
  return { x: anchor.x + d.x, y: anchor.y + d.y };
}

/**
 * ALONG-AXIS variant of the SNAP-MODE step (ADR-363) — quantize the DISTANCE from
 * `anchor` to `point` ALONG their direction, so the drawn **length** lands on the
 * step grid (e.g. 5 cm) while the direction (ORTHO / POLAR angle / free) is preserved.
 *
 * This is the correct semantic for DRAWING (a line/wall grows in length increments):
 * the rectangular {@link applyPointStepSnap} quantizes X and Y independently, which on
 * an angled (POLAR) segment snaps to a grid that does NOT keep the length a clean
 * multiple — the cause of «το Q υπολογίζει το βήμα με βάση Χ,Υ και όχι τη γωνία».
 * Grips keep {@link applyPointStepSnap} (moving an entity IS a rectangular X/Y delta).
 *
 * Same F9 + Q-held gate + mm→scene scale as the rest of the step SSoT; reuses the
 * `quantizeAlongPath` ray-quantizer (the SAME SSoT the zoom-adaptive wall step uses).
 * No-op (returns `point`) unless armed, or when point == anchor (degenerate).
 */
export function applyAlongAxisStepSnap(point: Point2D, anchor: Point2D): Point2D {
  if (!isGripStepActive()) return point;
  const stepScene = cadToggleState.getSnapStep() * immediateSceneScale.getMmToScene();
  return quantizePointFromAnchor(point, anchor, stepScene);
}
