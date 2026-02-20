/**
 * 🚀 IMMEDIATE SNAP STORE
 *
 * Zero-cost imperative store for snap results.
 * Allows components to read the latest snap result WITHOUT subscribing
 * to React context updates, eliminating expensive re-renders.
 *
 * PROBLEM:
 *   CanvasSection reads currentSnapResult from SnapContext → re-renders on
 *   EVERY snap update (30-60×/sec). CanvasSection is heavy (dozens of hooks)
 *   → this causes the "βαριά κίνηση" (heavy cursor movement) the user reports.
 *
 * SOLUTION:
 *   Store snap result in a plain mutable variable. CanvasSection reads it
 *   imperatively inside a useMemo that already re-evaluates on mouseWorld change.
 *   No React subscription → no re-render from snap updates.
 *
 * @see ImmediatePositionStore.ts — Same pattern for cursor position
 */

import type { Point2D } from '../../rendering/types/Types';

export interface ImmediateSnapResult {
  found: boolean;
  point: Point2D;
  mode: string;
  /** Entity/guide ID for highlight (e.g., guide.id when mode='guide') */
  entityId?: string;
}

// ─── Mutable singleton ────────────────────────────────────────────────────
let currentSnap: ImmediateSnapResult | null = null;

/** Write — called from useCentralizedMouseHandlers on every snap detection */
export function setImmediateSnap(snap: ImmediateSnapResult | null): void {
  currentSnap = snap;
}

/** Read — called imperatively from effectiveMouseWorld and other consumers */
export function getImmediateSnap(): ImmediateSnapResult | null {
  return currentSnap;
}

/** Clear — called when snap is disabled or on cleanup */
export function clearImmediateSnap(): void {
  currentSnap = null;
}
