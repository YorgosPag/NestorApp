/**
 * ADR-419 — Floor-finish tool live-preview store.
 *
 * Mirror of `bim/roofs/roof-preview-store.ts` (ADR-417): the floor-finish
 * tool maintains its own FSM in `useFloorFinishTool` (`phase`, `vertices`)
 * which is NOT routed through `useUnifiedDrawing.machineContext.points`.
 * Without this store `updatePreview` reads an always-empty `tempPoints`
 * for `tool === 'floor-finish'` and the rubber-band polygon preview never
 * surfaces while drawing.
 *
 * Single-writer (useFloorFinishTool), multi-reader (updatePreview) module-level store.
 * Zero `useSyncExternalStore` on high-frequency stores — ADR-040-safe.
 *
 * @see bim/roofs/roof-preview-store.ts — the SSoT pattern
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';

export interface FloorFinishPreviewState {
  /** Footprint vertices so far (user-click order). Empty when idle / awaiting first vertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: FloorFinishPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

type Listener = () => void;

let currentState: FloorFinishPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FloorFinishPreviewState {
  return currentState;
}

function getServerSnapshot(): FloorFinishPreviewState {
  return EMPTY;
}

function polylinesEqual(a: readonly Point2D[], b: readonly Point2D[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

export const floorFinishPreviewStore = {
  /** Writer — called by `useFloorFinishTool` on every state transition. */
  set(next: FloorFinishPreviewState): void {
    if (polylinesEqual(currentState.vertices, next.vertices)) return;
    currentState = { vertices: next.vertices.map((p) => ({ x: p.x, y: p.y })) };
    for (const l of listeners) l();
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (currentState === EMPTY) return;
    currentState = EMPTY;
    for (const l of listeners) l();
  },
  /** Non-React reader — for `updatePreview` consumer. */
  get(): FloorFinishPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest floor-finish-preview state. */
export function useFloorFinishPreview(): FloorFinishPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
