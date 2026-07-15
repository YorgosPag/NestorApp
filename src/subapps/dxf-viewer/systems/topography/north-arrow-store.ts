/**
 * ADR-656 M12 — NorthArrowStore: the North-arrow PRESENTATION state.
 *
 * Owns whether the arrow is shown and which north it points to (Grid / True). Separate from the
 * grid store (M11) and the F7 drawing-aid grid. The panel toggles reflect/set it; the screen HUD
 * leaf and the bake hook read it.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040) — zero React state. The panel and the
 * HUD leaf subscribe via `useSyncExternalStore` (LOW-freq — neither is a canvas orchestrator, so
 * CHECK 6C is satisfied).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_NORTH_ARROW_OPTS, type NorthArrowOptions, type NorthMode } from './north-arrow-config';

const store = createExternalStore<NorthArrowOptions>(DEFAULT_NORTH_ARROW_OPTS);

/** Full snapshot (stable while unchanged — safe as a `useSyncExternalStore` getSnapshot). */
export function getNorthArrowOptions(): NorthArrowOptions {
  return store.get();
}

/** Show/hide the north-arrow HUD. No-op if unchanged. */
export function setNorthArrowVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Flip the north-arrow HUD (checkbox entry point). */
export function toggleNorthArrowVisible(): void {
  const current = store.get();
  store.set({ ...current, visible: !current.visible });
}

/** Choose which north the arrow points to (Grid / True). No-op if unchanged. */
export function setNorthArrowMode(mode: NorthMode): void {
  const current = store.get();
  if (current.mode === mode) return;
  store.set({ ...current, mode });
}

/** Subscribe to north-arrow changes; returns unsubscribe. */
export function subscribeNorthArrow(listener: () => void): () => void {
  return store.subscribe(listener);
}
