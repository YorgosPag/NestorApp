/**
 * ADR-455 — imperative drag state for the on-canvas X/Y section-cut handle.
 *
 * Zero React state (ADR-040): the mouse pipeline reads/writes this synchronously at
 * event time. While an axis is set, the move handler routes pointer motion to
 * `setAxisCutPosition`; the up / leave handlers clear it. The 2D overlay redraws via the
 * existing bim-render-settings subscription (a position change marks the canvas dirty),
 * so the handle + section line follow the cursor frame-for-frame without a store
 * subscription here. This replaces the old Radix normalized slider, whose thumb could
 * never align with a world-anchored section line.
 */

import type { AxisCutKey } from '../../config/bim-render-settings-types';

let draggingAxis: AxisCutKey | null = null;

/** Begin dragging the handle of the given axis cut. */
export function startAxisCutDrag(axis: AxisCutKey): void {
  draggingAxis = axis;
}

/** End any in-progress handle drag (mouse-up / leave). Idempotent. */
export function endAxisCutDrag(): void {
  draggingAxis = null;
}

/** The axis whose handle is being dragged, or `null` when idle. */
export function getAxisCutDragAxis(): AxisCutKey | null {
  return draggingAxis;
}

/** True while a section-cut handle is being dragged. */
export function isAxisCutDragging(): boolean {
  return draggingAxis !== null;
}
