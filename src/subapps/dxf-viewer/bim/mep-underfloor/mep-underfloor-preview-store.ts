/**
 * ADR-408 Εύρος Β #3 — Underfloor tool live-preview store.
 *
 * Mirror of `bim/floor-finishes/floor-finish-preview-store.ts`: the underfloor tool
 * maintains its own FSM in `useMepUnderfloorTool` (`phase`, `vertices`) which is NOT
 * routed through `useUnifiedDrawing.machineContext.points`. Without this store
 * `resolveBimToolTempPoints` reads an always-empty `tempPoints` for
 * `tool === 'mep-underfloor'` and the rubber-band footprint preview never surfaces.
 *
 * Single-writer (useMepUnderfloorTool), multi-reader (preview generator) module-level
 * store. Zero `useSyncExternalStore` on high-frequency stores — ADR-040-safe.
 *
 * @see bim/floor-finishes/floor-finish-preview-store.ts — the SSoT pattern
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';

export interface MepUnderfloorPreviewState {
  /** Footprint vertices so far (user-click order). Empty when idle / awaiting first vertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: MepUnderfloorPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

type Listener = () => void;

let currentState: MepUnderfloorPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MepUnderfloorPreviewState {
  return currentState;
}

function getServerSnapshot(): MepUnderfloorPreviewState {
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

export const mepUnderfloorPreviewStore = {
  /** Writer — called by `useMepUnderfloorTool` on every state transition. */
  set(next: MepUnderfloorPreviewState): void {
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
  /** Non-React reader — for the preview generator consumer. */
  get(): MepUnderfloorPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest underfloor-preview state. */
export function useMepUnderfloorPreview(): MepUnderfloorPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
