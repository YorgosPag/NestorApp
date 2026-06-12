/**
 * SnapDrawingModeStore — event-time "are we currently drawing/placing" flag for the
 * snap pipeline (ADR-189).
 *
 * Plain non-React module store (sibling of {@link GripSnapStore} / GuideStore singleton
 * reads). The snap engines run synchronously inside the mouse pipeline and cannot reach
 * React's `activeTool` state; `mouse-handler-move` / `mouse-handler-up` already compute
 * `isInDrawingMode(activeTool, overlayMode)`, so they publish it here right before each
 * `findSnapPoint` call.
 *
 * Sole reader (today): `GuideSnapEngine` — while drawing, guides attract ONLY at their
 * INTERSECTIONS (✕ crossings); the single-guide line / midpoint / fractal "slide" snaps
 * are suppressed (Giorgio: «στο σχεδιασμό με ενδιαφέρουν μόνο οι διασταυρώσεις»). Outside
 * drawing mode the full guide snapping stays active.
 *
 * @see snapping/engines/GuideSnapEngine.ts — reader
 * @see systems/tools/ToolStateManager.ts — isInDrawingMode source
 */

let drawingMode = false;

/** Writer — called by the mouse handlers before `findSnapPoint`. */
export function setSnapDrawingMode(active: boolean): void {
  drawingMode = active;
}

/** Live read for snap engines (event-time, zero React). */
export function isSnapDrawingMode(): boolean {
  return drawingMode;
}
