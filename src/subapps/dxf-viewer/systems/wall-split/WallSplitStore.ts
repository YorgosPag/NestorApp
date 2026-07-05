/**
 * Wall Split Store — ADR-363 Phase 5.6 (knife-line mode).
 *
 * Module-level pub/sub store for the wall-split KNIFE-LINE first point.
 * Zero React state — mirrors ZoomWindowStore / LassoStore pattern
 * (ADR-040: high-frequency preview data must not flow through React state).
 *
 * The knife tool is a 2-click "split by line": the FIRST click sets `firstPoint`
 * here; the live rubber-band preview (WallSplitKnifePreviewMount) reads it and
 * draws the segment `firstPoint → cursor`, highlighting every wall the segment
 * would cut. The SECOND click performs the multi-split and resets the store.
 *
 * Single-writer: useWallSplitTool (click / escape).
 * Multi-reader:  WallSplitKnifePreviewMount leaf (subscribes to `firstPoint`).
 *
 * Snapshot stability: when `firstPoint` is unchanged the same object reference is
 * returned — `useSyncExternalStore` skips re-renders on no-ops.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

// ── State ─────────────────────────────────────────────────────────────────────

export interface WallSplitKnifeState {
  /** First knife point (world coords), or null while awaiting the first click. */
  readonly firstPoint: Point2D | null;
}

const EMPTY: WallSplitKnifeState = Object.freeze({ firstPoint: null });

// ── Module state ──────────────────────────────────────────────────────────────
// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — both mutators
// keep their own manual pre-check, matching the hand-rolled store's
// unconditional `notify()` after each accepted mutation.

const store = createExternalStore<WallSplitKnifeState>(EMPTY);

function getServerSnapshot(): WallSplitKnifeState { return EMPTY; }

// ── Public store API ──────────────────────────────────────────────────────────

export const WallSplitStore = {
  /** Set the first knife point (world coords). No-op when unchanged. */
  setFirstPoint(point: Point2D): void {
    const prev = store.get().firstPoint;
    if (prev && prev.x === point.x && prev.y === point.y) return;
    store.set({ firstPoint: { x: point.x, y: point.y } });
  },

  /** Clear the first point (second click committed / tool deactivated / Escape). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },

  /** Non-React reader (tests + imperative code). */
  get(): WallSplitKnifeState { return store.get(); },

  subscribe: store.subscribe,
  getSnapshot: store.get,
  getServerSnapshot,
};

// ── React hook ────────────────────────────────────────────────────────────────

/** Returns the current knife first point for the preview leaf consumer. */
export function useWallSplitFirstPoint(): Point2D | null {
  return useSyncExternalStore(store.subscribe, store.get, getServerSnapshot).firstPoint;
}
