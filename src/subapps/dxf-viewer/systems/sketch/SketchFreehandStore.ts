/**
 * SketchFreehandStore — freehand «Μολύβι» drag-to-draw trace (ADR-658 M1).
 *
 * Thin adapter over the `createFreehandTraceStore` SSoT factory: on pointerup it
 * emits `sketch:freehand-complete` with the collected world-space trace. The
 * `useSketchFreehandCommit` host then RDP-simplifies and commits a PolylineEntity
 * through the canonical `completeEntity` pipeline (undoable). Event-decoupled,
 * exactly like the lasso-crop store — but it produces geometry, not a crop.
 */
import { EventBus } from '../events/EventBus';
import { createFreehandTraceStore } from '../freehand/createFreehandTraceStore';

export const SketchFreehandStore = createFreehandTraceStore({
  minPoints: 2, // ≥ 2 points → a polyline; ≥ 3 + near-close → closed polygon (D5)
  onFinish: (points, nearClose) => {
    // D5 — release near the start → closed polygon (needs ≥ 3 pts to enclose an area).
    const closed = nearClose && points.length >= 3;
    EventBus.emit('sketch:freehand-complete', { points, closed });
  },
});
