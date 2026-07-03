/**
 * ADR-363 §column-polygon-sketch — Column polygon-draw live-preview store.
 *
 * Mirror του `bim/slabs/slab-preview-store.ts`: το column tool (placementMode='polygon')
 * τρέχει το vertex-chain FSM στο κοινό `usePolygonSketchChain`, εκτός του
 * `useUnifiedDrawing.machineContext.points`. Single-writer / multi-reader module store:
 * το `useColumnTool` γράφει τις `vertices` σε κάθε chain transition· το `updatePreview`
 * (`drawing-preview-tool-points`) διαβάζει μέσω `.get()` και ανακατασκευάζει τα
 * `tempPoints` για το tool-agnostic `generateSlabPreview` (ίδιο rubber-band outline
 * με slab/roof/floor-finish). Μηδέν cross-hook dependency, ADR-040-safe.
 *
 * @see ../slabs/slab-preview-store.ts (pattern)
 * @see ../../hooks/drawing/drawing-preview-tool-points.ts (reader)
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';

export interface ColumnPolygonPreviewState {
  /** Polygon vertices so far (user-click order). Empty when idle / awaitingFirstVertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: ColumnPolygonPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

type Listener = () => void;

let currentState: ColumnPolygonPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ColumnPolygonPreviewState {
  return currentState;
}

function getServerSnapshot(): ColumnPolygonPreviewState {
  return EMPTY;
}

function verticesEqual(a: readonly Point2D[], b: readonly Point2D[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

export const columnPolygonPreviewStore = {
  /** Writer — called by `useColumnTool` on every chain transition. */
  set(next: ColumnPolygonPreviewState): void {
    if (verticesEqual(currentState.vertices, next.vertices)) return;
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
  get(): ColumnPolygonPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest column-polygon-preview state. */
export function useColumnPolygonPreview(): ColumnPolygonPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
