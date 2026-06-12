/**
 * GripStepAnchorStore — crosshair snap-to-grid anchor during a grip drag (ADR-363).
 *
 * Holds the WORLD anchor point of the in-progress 2D grip drag (= the grabbed
 * grip's position, identical to the `anchorPos` that feeds the rubber-band ghost
 * in `grip-projections.buildDxfDragPreview`). The anchor is CONSTANT for the whole
 * drag, so storing it (not a per-frame quantized position) lets the reader compute
 * the snapped crosshair position with the FRESH cursor world pos every frame — zero
 * lag, and WYSIWYG-identical to the ghost (same anchor + same `applyGripStepSnap`).
 *
 * `mouse-handler-move.ts` reads this (mirroring the {@link GripSnapStore} grip-hover
 * lock) and, while SNAP-MODE (F9) + Q are active, overrides `setImmediatePosition`
 * so the crosshair "clicks" onto the step grid (AutoCAD F9 Snap parity) instead of
 * gliding freely. Empty (null) outside an active step drag ⇒ crosshair stays raw.
 *
 * Sole writer: `useUnifiedGripInteraction.handleMouseMove` (drag branch) + its
 * reset paths (`resetToIdle` / selection-change effect) clear it.
 *
 * @see systems/cursor/GripSnapStore.ts — sibling (grip-hover crosshair lock)
 * @see bim/grips/grip-step-quantize.ts — isGripStepActive / applyGripStepSnap
 */
import type { Point2D } from '../../rendering/types/Types';

let stepAnchor: Point2D | null = null;

export function setGripStepAnchor(anchor: Point2D): void {
  stepAnchor = anchor;
}

export function clearGripStepAnchor(): void {
  stepAnchor = null;
}

export function getGripStepAnchor(): Point2D | null {
  return stepAnchor;
}
