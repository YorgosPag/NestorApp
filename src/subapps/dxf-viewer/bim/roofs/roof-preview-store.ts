/**
 * ADR-417 — Roof tool live-preview store.
 *
 * Mirror of `bim/slabs/slab-preview-store.ts` (ADR-363 Phase 6.5.B): the roof
 * tool maintains its own FSM in `useRoofTool` (`phase`, `vertices`) which is NOT
 * routed through `useUnifiedDrawing.machineContext.points`. Without this store
 * `updatePreview` reads an always-empty `tempPoints` for `tool === 'roof'` and
 * the rubber-band footprint-outline preview never surfaces (the reported
 * «κλικ αλλά δεν εμφανίζεται τίποτα» symptom while drawing).
 *
 * Single-writer (useRoofTool), multi-reader (updatePreview) module-level store.
 * Zero `useSyncExternalStore` on high-frequency stores — ADR-040-safe.
 *
 * @see bim/slabs/slab-preview-store.ts — the SSoT pattern
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';

export interface RoofPreviewState {
  /** Footprint vertices so far (user-click order). Empty when idle / awaiting first vertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: RoofPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

type Listener = () => void;

let currentState: RoofPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RoofPreviewState {
  return currentState;
}

function getServerSnapshot(): RoofPreviewState {
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

export const roofPreviewStore = {
  /** Writer — called by `useRoofTool` on every state transition. */
  set(next: RoofPreviewState): void {
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
  get(): RoofPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest roof-preview state. */
export function useRoofPreview(): RoofPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
