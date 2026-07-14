/**
 * ADR-656 M11 — TopoGridStore: the ΕΓΣΑ87 coordinate-grid PRESENTATION state.
 *
 * Owns whether the live screen graticule is shown and the fixed step (metres) the «Bake to
 * drawing» export uses. This is SEPARATE from the drawing-aid F7 grid (`globalGridStore`) — a
 * different toggle, shortcut and store, per ADR-656 §3.3.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040) — zero React state. The panel and the
 * canvas micro-leaf subscribe via `useSyncExternalStore` (LOW-freq, neither is a canvas
 * orchestrator, so CHECK 6C is satisfied — the Shell never subscribes).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_GRID_DISPLAY_OPTS, type GridDisplayOptions } from './topo-grid-config';

const store = createExternalStore<GridDisplayOptions>(DEFAULT_GRID_DISPLAY_OPTS);

/** Full snapshot (stable while unchanged — safe as a `useSyncExternalStore` getSnapshot). */
export function getGridDisplayOptions(): GridDisplayOptions {
  return store.get();
}

/** Whether the live screen graticule is currently shown. */
export function isTopoGridVisible(): boolean {
  return store.get().visible;
}

/** Show/hide the live screen graticule. No-op if unchanged. */
export function setTopoGridVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Flip the live screen graticule (the shortcut / checkbox entry point). */
export function toggleTopoGridVisible(): void {
  const current = store.get();
  store.set({ ...current, visible: !current.visible });
}

/** Set the fixed export step (metres) the bake uses. No-op if unchanged or non-positive. */
export function setTopoGridExportStepM(exportStepM: number): void {
  const current = store.get();
  if (!(exportStepM > 0) || current.exportStepM === exportStepM) return;
  store.set({ ...current, exportStepM });
}

/** Subscribe to grid-display changes; returns unsubscribe. */
export function subscribeTopoGrid(listener: () => void): () => void {
  return store.subscribe(listener);
}
