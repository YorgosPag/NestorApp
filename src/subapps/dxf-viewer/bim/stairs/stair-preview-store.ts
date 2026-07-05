/**
 * ADR-358 Phase 8 (preview SSoT hotfix) — Stair tool live-preview store.
 *
 * The stair tool maintains its own state machine in `useStairTool`
 * (`basePoint`, `direction`, `phase`) which is intentionally NOT routed
 * through the generic `useUnifiedDrawing.machineContext.points` pipeline
 * (Phase 5a: stair has different completion semantics than line/rect/etc.).
 * Consequence: the preview generator inside `useUnifiedDrawing.updatePreview`
 * was reading an always-empty `tempPoints` array for `tool === 'stair'`,
 * so the basePoint marker / ghost rubber-band / walkline preview never
 * surfaced on the canvas (regression observed 2026-05-17).
 *
 * Fix — single-writer, multi-reader module-level store (pattern identical
 * to `statusbar/stair-status-store.ts`). `useStairTool` writes its current
 * `basePoint` + `direction` on every state transition; `updatePreview`
 * reads via `useStairPreview()` and passes the reconstructed `tempPoints`
 * tuple to `generateStairPreview`. Zero cross-hook dependency, zero
 * `useSyncExternalStore` on high-frequency stores, ADR-040-safe.
 *
 * Snapshot stability: when nothing changes between two reads, the same
 * object reference is returned — useSyncExternalStore relies on this to
 * skip re-render scheduling.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.2 §7.2 row 8
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

export interface StairPreviewState {
  /** First click location (basePoint). `null` when stair tool is idle / awaitingBasePoint. */
  readonly basePoint: Point2D | null;
  /** Second click direction in degrees (0° = +X). `null` when awaitingDirection or earlier. */
  readonly direction: number | null;
}

const EMPTY: StairPreviewState = Object.freeze({ basePoint: null, direction: null });

const store = createExternalStore<StairPreviewState>(EMPTY);

function pointsEqual(a: Point2D | null, b: Point2D | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

export const stairPreviewStore = {
  /** Writer — called by `useStairTool` on every relevant state transition. */
  set(next: StairPreviewState): void {
    const currentState = store.get();
    if (
      pointsEqual(currentState.basePoint, next.basePoint) &&
      currentState.direction === next.direction
    ) {
      return;
    }
    const nextState: StairPreviewState = {
      basePoint: next.basePoint ? { x: next.basePoint.x, y: next.basePoint.y } : null,
      direction: next.direction,
    };
    store.set(nextState);
  },
  /** Reset back to empty (tool deactivated / idle). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },
  /** Reader (non-React) — escape hatch for tests + non-React consumers (updatePreview). */
  get(): StairPreviewState {
    return store.get();
  },
};

/** React subscription. Returns the latest stair-preview state. */
export function useStairPreview(): StairPreviewState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
