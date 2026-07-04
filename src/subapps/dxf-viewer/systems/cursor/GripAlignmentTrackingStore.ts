/**
 * GripAlignmentTrackingStore — imperative store for the live grip-drag AutoAlign result.
 *
 * ADR-357 / ADR-562 Φ9.2 / ADR-363 — while ANY entity grip is dragged (dimension defPoint,
 * plain DXF line endpoint / centre-move, …), the mouse-move handler resolves the alignment
 * tracking ONCE per frame (`resolveActionAlignmentTracking`) and publishes the result here.
 * The matching ghost hook reads it and paints the traces via `paintGripAlignmentTracking`,
 * so the geometry (the aligned point that fed the ghost delta) and the painted traces derive
 * from the SAME single resolve — ONE brain, zero double ambient-scan (Google-level, WYSIWYG
 * preview ≡ commit).
 *
 * ONE store for every grip family (only one grip is dragged at a time), so there is no
 * per-consumer duplicate (Giorgio «FULL SSoT»). Generalised from the former
 * `DimAlignmentTrackingStore` (dim-only) when the plain-line grips joined as a second consumer.
 *
 * Pattern identical to ImmediateSnapStore / GripDragStore: zero-React, mutable singleton.
 *   • Written by mouse-handler-move (every frame during a dim / line grip drag; `null` = no snap).
 *   • Read by useDimGripGhostPreview + useGripGhostPreview (paint).
 *   • Cleared by GripDragStore.clearActiveDragGrip (drag end / ESC lifecycle SSoT) and on commit.
 *
 * @see hooks/dimensions/dim-alignment-tracking.ts — resolve + paint SSoT
 * @see systems/cursor/GripDragStore.ts — sibling zero-React drag store
 */

import type { ComposedTracking } from '../tracking/ambient-tracking-compose';

let current: ComposedTracking | null = null;

/** Write — the latest resolved grip-drag alignment (or `null` when nothing is snapped). */
export function setGripAlignmentTracking(tracking: ComposedTracking | null): void {
  current = tracking;
}

/** Read — the live grip-drag alignment result for the paint pass (`null` when none). */
export function getGripAlignmentTracking(): ComposedTracking | null {
  return current;
}

/** Clear — called at drag end / ESC / commit so stale traces never linger. */
export function clearGripAlignmentTracking(): void {
  current = null;
}
