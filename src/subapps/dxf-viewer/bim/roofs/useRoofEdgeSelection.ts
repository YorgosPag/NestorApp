/**
 * ROOF EDGE SELECTION HOOK — micro-leaf subscriber (ADR-417 Φ-per-edge).
 *
 * Subscribes to `roofEdgeSelectionStore` via `useSyncExternalStore` so only the
 * calling leaf re-renders when the edited roof edge changes — NOT the parent
 * orchestrator. Folded into the DXF canvas `renderOptions` so the dynamic
 * «selected» render pass re-runs (live edge highlight), exactly like
 * `useHoveredEntity`.
 *
 * @see systems/hover/useHover.ts — το πρότυπο
 */

import { useSyncExternalStore } from 'react';
import {
  subscribeSelectedRoofEdge,
  getSelectedRoofEdge,
  type SelectedRoofEdge,
} from './roof-edge-selection-store';

/** Returns the currently-edited roof edge (null when none). */
export function useSelectedRoofEdge(): SelectedRoofEdge | null {
  return useSyncExternalStore(
    subscribeSelectedRoofEdge,
    getSelectedRoofEdge,
    getSelectedRoofEdge,
  );
}
