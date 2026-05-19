/**
 * Wall Split Store — ADR-363 Phase 5.6.
 *
 * Module-level pub/sub store for the wall-split tool hover preview.
 * Zero React state — mirrors TrimToolStore / WallPreviewStore pattern
 * (ADR-040: high-frequency mouse-move data must not flow through React state).
 *
 * Single-writer: useWallSplitTool (updates on every mousemove).
 * Multi-reader:  wall-split preview renderer (reads split point + indicator line).
 *
 * Snapshot stability: when nothing changes between two reads, the same object
 * reference is returned — `useSyncExternalStore` skips re-renders on no-ops.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';

// ── State ─────────────────────────────────────────────────────────────────────

export interface WallSplitHoverState {
  /** ID of the wall currently under the cursor, or null when no wall is hit. */
  readonly hoveredWallId: string | null;
  /** Axis-projected split point in world coordinates. */
  readonly splitPoint: Point2D | null;
  /** Endpoints of the perpendicular indicator line across the wall width. */
  readonly splitLine: readonly [Point2D, Point2D] | null;
}

const EMPTY: WallSplitHoverState = Object.freeze({
  hoveredWallId: null,
  splitPoint: null,
  splitLine: null,
});

// ── Module state ──────────────────────────────────────────────────────────────

type Listener = () => void;
let current: WallSplitHoverState = EMPTY;
const listeners = new Set<Listener>();

// ── Internal helpers ──────────────────────────────────────────────────────────

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): WallSplitHoverState { return current; }
function getServerSnapshot(): WallSplitHoverState { return EMPTY; }

function notify(): void {
  for (const l of listeners) l();
}

function pointsEq(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

// ── Public store API ──────────────────────────────────────────────────────────

export const WallSplitStore = {
  /**
   * Update hover state. No-op when wall + split point are unchanged (ref +
   * coordinate equality) so the renderer does not re-paint on every mousemove
   * when the cursor sits on the same axis position.
   */
  set(next: WallSplitHoverState): void {
    if (
      next.hoveredWallId === current.hoveredWallId &&
      pointsEq(next.splitPoint, current.splitPoint)
    ) return;
    current = {
      hoveredWallId: next.hoveredWallId,
      splitPoint: next.splitPoint ? { x: next.splitPoint.x, y: next.splitPoint.y } : null,
      splitLine: next.splitLine
        ? [
            { x: next.splitLine[0].x, y: next.splitLine[0].y },
            { x: next.splitLine[1].x, y: next.splitLine[1].y },
          ]
        : null,
    };
    notify();
  },

  /** Reset to empty (tool deactivated / cursor leaves canvas). */
  reset(): void {
    if (current === EMPTY) return;
    current = EMPTY;
    notify();
  },

  /** Non-React reader (tests + imperative code). */
  get(): WallSplitHoverState { return current; },

  /** Raw subscribe for non-useSyncExternalStore consumers. */
  subscribe,
};

// ── React hook ────────────────────────────────────────────────────────────────

/** Returns the current wall-split hover state for React renderer consumers. */
export function useWallSplitPreview(): WallSplitHoverState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
