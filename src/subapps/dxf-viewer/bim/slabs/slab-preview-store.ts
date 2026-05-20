/**
 * ADR-363 Phase 6.5.B — Slab tool live-preview store.
 *
 * Mirror of `bim/walls/wall-preview-store.ts` (ADR-363 Phase 1C): the slab
 * tool maintains its own FSM in `useSlabTool` (`phase`, `vertices`,
 * `overrides`) which is NOT routed through `useUnifiedDrawing.machineContext.points`.
 * Consequence: `updatePreview` would read an always-empty `tempPoints` for
 * `tool === 'slab'` and the rubber-band / polygon-outline preview never surfaces.
 *
 * Fix — single-writer, multi-reader module-level store:
 * `useSlabTool` writes `vertices` + `overrides` on every state transition;
 * `updatePreview` reads via `slabPreviewStore.get()` and reconstructs
 * `tempPoints` for `generateSlabPreview`. Zero cross-hook dependency,
 * zero `useSyncExternalStore` on high-frequency stores, ADR-040-safe.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 6.5.B
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { SlabParamOverrides } from '../../hooks/drawing/slab-completion';

export interface SlabPreviewState {
  /** Polygon vertices so far (user-click order). Empty when idle / awaitingFirstVertex. */
  readonly vertices: readonly Point2D[];
  /** Tool overrides (kind / thickness) — needed to match committed entity params. */
  readonly overrides: SlabParamOverrides;
}

const EMPTY: SlabPreviewState = Object.freeze({
  vertices: Object.freeze([]) as readonly Point2D[],
  overrides: Object.freeze({}) as SlabParamOverrides,
});

type Listener = () => void;

let currentState: SlabPreviewState = EMPTY;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SlabPreviewState {
  return currentState;
}

function getServerSnapshot(): SlabPreviewState {
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

function overridesEqual(a: SlabParamOverrides, b: SlabParamOverrides): boolean {
  if (a === b) return true;
  return a.kind === b.kind && a.thickness === b.thickness;
}

export const slabPreviewStore = {
  /** Writer — called by `useSlabTool` on every state transition. */
  set(next: SlabPreviewState): void {
    if (
      polylinesEqual(currentState.vertices, next.vertices) &&
      overridesEqual(currentState.overrides, next.overrides)
    ) {
      return;
    }
    currentState = {
      vertices: next.vertices.map((p) => ({ x: p.x, y: p.y })),
      overrides: { ...next.overrides },
    };
    for (const l of listeners) l();
  },
  /** Reset to empty (tool deactivated / committed / idle). */
  reset(): void {
    if (currentState === EMPTY) return;
    currentState = EMPTY;
    for (const l of listeners) l();
  },
  /** Non-React reader — for `updatePreview` consumer. */
  get(): SlabPreviewState {
    return currentState;
  },
};

/** React subscription. Returns the latest slab-preview state. */
export function useSlabPreview(): SlabPreviewState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
