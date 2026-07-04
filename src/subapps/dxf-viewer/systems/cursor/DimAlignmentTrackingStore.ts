/**
 * DimAlignmentTrackingStore — imperative store for the live dim-grip AutoAlign result.
 *
 * ADR-562 Φ9.2 / ADR-357 — while a dimension grip is dragged, the mouse-move handler
 * resolves the alignment tracking ONCE per frame (`resolveDimAlignmentTracking`) and
 * publishes the result here. The dim-grip ghost (`useDimGripGhostPreview`) reads it and
 * paints the traces via `paintDimAlignmentTracking`, so the geometry (the aligned point
 * that fed the ghost delta) and the painted traces derive from the SAME single resolve
 * — ONE brain, zero double ambient-scan (Google-level, WYSIWYG preview ≡ commit).
 *
 * Pattern identical to ImmediateSnapStore / GripDragStore: zero-React, mutable singleton.
 *   • Written by mouse-handler-move (every frame during a dim grip drag; `null` = no snap).
 *   • Read by useDimGripGhostPreview (paint).
 *   • Cleared by GripDragStore.clearActiveDragGrip (drag end / ESC lifecycle SSoT) and on commit.
 *
 * @see hooks/dimensions/dim-alignment-tracking.ts — resolve + paint SSoT
 * @see systems/cursor/GripDragStore.ts — sibling zero-React drag store
 */

import type { ComposedTracking } from '../tracking/ambient-tracking-compose';

let current: ComposedTracking | null = null;

/** Write — the latest resolved dim-grip alignment (or `null` when nothing is snapped). */
export function setDimAlignmentTracking(tracking: ComposedTracking | null): void {
  current = tracking;
}

/** Read — the live dim-grip alignment result for the paint pass (`null` when none). */
export function getDimAlignmentTracking(): ComposedTracking | null {
  return current;
}

/** Clear — called at drag end / ESC / commit so stale traces never linger. */
export function clearDimAlignmentTracking(): void {
  current = null;
}
