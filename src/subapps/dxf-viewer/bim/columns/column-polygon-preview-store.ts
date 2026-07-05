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
import { createExternalStore } from '../../stores/createExternalStore';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';

export interface ColumnPolygonPreviewState {
  /** Polygon vertices so far (user-click order). Empty when idle / awaitingFirstVertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: ColumnPolygonPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

const store = createExternalStore<ColumnPolygonPreviewState>(EMPTY);

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
    if (verticesEqual(store.get().vertices, next.vertices)) return;
    const nextState: ColumnPolygonPreviewState = {
      vertices: projectVerticesTo2D(next.vertices),
    };
    store.set(nextState);
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },
  /** Non-React reader — for `updatePreview` consumer. */
  get(): ColumnPolygonPreviewState {
    return store.get();
  },
};

/** React subscription. Returns the latest column-polygon-preview state. */
export function useColumnPolygonPreview(): ColumnPolygonPreviewState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
