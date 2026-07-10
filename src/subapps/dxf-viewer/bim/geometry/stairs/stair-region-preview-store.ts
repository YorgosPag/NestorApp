/**
 * ADR-619 §stair-from-region — «Σκάλα από περιοχή» polygon-draw live-preview store.
 *
 * Mirror του `bim/columns/column-polygon-preview-store.ts`: το εργαλείο
 * `stair-from-region` τρέχει το κοινό vertex-chain FSM (`usePolygonSketchChain`)
 * εκτός του `useUnifiedDrawing.machineContext.points`. Single-writer / multi-reader
 * module store: το `useStairRegionSketch` γράφει τις `vertices` σε κάθε chain
 * transition· το `resolveBimToolTempPoints` (`drawing-preview-tool-points`) διαβάζει
 * μέσω `.get()` και ανακατασκευάζει τα `tempPoints` για το tool-agnostic rubber-band
 * outline (ίδιο με slab/column-from-polygon). Μηδέν cross-hook dependency, ADR-040-safe.
 *
 * @see ../../columns/column-polygon-preview-store.ts (pattern)
 * @see ../../../hooks/drawing/drawing-preview-tool-points.ts (reader)
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { createExternalStore } from '../../../stores/createExternalStore';
import { projectVerticesTo2D } from '../shared/polygon-utils';

export interface StairRegionPreviewState {
  /** Κορυφές πολυγώνου μέχρι τώρα (σειρά κλικ). Κενό όταν idle / awaitingFirstVertex. */
  readonly vertices: readonly Point2D[];
}

const EMPTY: StairRegionPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
});

const store = createExternalStore<StairRegionPreviewState>(EMPTY);

function verticesEqual(a: readonly Point2D[], b: readonly Point2D[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}

export const stairRegionPreviewStore = {
  /** Writer — καλείται από το `useStairRegionSketch` σε κάθε chain transition. */
  set(next: StairRegionPreviewState): void {
    if (verticesEqual(store.get().vertices, next.vertices)) return;
    const nextState: StairRegionPreviewState = {
      vertices: projectVerticesTo2D(next.vertices),
    };
    store.set(nextState);
  },
  /** Reset σε κενό (tool deactivated / committed / idle). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },
  /** Non-React reader — για τον `resolveBimToolTempPoints` consumer. */
  get(): StairRegionPreviewState {
    return store.get();
  },
};

/** React subscription. Επιστρέφει την τελευταία stair-region-preview κατάσταση. */
export function useStairRegionPreview(): StairRegionPreviewState {
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
}
