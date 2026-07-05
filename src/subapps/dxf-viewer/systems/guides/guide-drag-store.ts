/**
 * ADR-441 Slice 3-perf — Guide drag-state SSoT (imperative, zero-React).
 *
 * Κρατά «ποιος οδηγός σύρεται αυτή τη στιγμή» (ή `null`). Imperative singleton
 * (mirror `ImmediatePositionStore`/`HoverStore`) ώστε να διαβάζεται μηδέν-lag από:
 *   - `useHostingReconciler` → suppress του per-frame `setLevelScene` κατά το drag
 *     (το ζωντανό follow το αναλαμβάνει το ghost overlay· μηδέν React churn / bitmap
 *     rebuild ανά frame).
 *   - `GuideFollowGhostOverlay` → active gate (mount μόνο όσο σύρεται οδηγός).
 *
 * Set/clear από τα guide-drag mouse handlers (`useCanvasContainerHandlers`).
 *
 * @see ../../hooks/data/useHostingReconciler.ts — reconciler suppression consumer
 * @see ../../components/dxf-layout/GuideFollowGhostOverlay.tsx — live ghost consumer
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { createExternalStore } from '../../stores/createExternalStore';

type GuideDragListener = () => void;

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.7). `equals: Object.is`
// reproduces the hand-rolled `if (draggingGuideId === id) return` guard. This
// is click-driven (drag start/end), NOT a per-frame write — the live follow
// position is owned by the ghost overlay, not this store.
const store = createExternalStore<string | null>(null, { equals: Object.is });

/** Όρισε/καθάρισε τον οδηγό που σύρεται. No-op αν δεν αλλάζει (αποφυγή churn). */
export function setDraggingGuideId(id: string | null): void {
  store.set(id);
}

/** Ο οδηγός που σύρεται τώρα, ή `null`. Safe σε event-time/render-time read. */
export function getDraggingGuideId(): string | null {
  return store.get();
}

/** Subscribe σε αλλαγές drag-state (set/clear). Επιστρέφει unsubscribe. */
export function subscribeGuideDrag(listener: GuideDragListener): () => void {
  return store.subscribe(listener);
}
