/**
 * ADR-650 M3 — ContourDisplayStore: the DISPLAY style of the plan-view contours
 * (exact chords ↔ smoothed curve). The 2D sibling of `terrain-3d-store` — Civil
 * 3D's Surface ↔ Surface-Style split: the survey and the derived contour geometry
 * are untouched, this only owns HOW those same contours are drawn.
 *
 * Holds the CURRENT style so (a) the panel toggle reflects/sets it and (b) newly
 * generated contours inherit it (`useTopoContours`). Flipping it also restyles the
 * existing contour entities via `SetContourDisplayStyleCommand` (one undoable
 * step) — this store is the preference, the command is the scene write.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040) — zero React state; the
 * panel subscribes via `useSyncExternalStore` (LOW-freq, not a canvas orchestrator).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_CONTOUR_DISPLAY_STYLE, type ContourDisplayStyle } from './contour-config';

export interface ContourDisplayState {
  readonly style: ContourDisplayStyle;
}

const INITIAL: ContourDisplayState = { style: DEFAULT_CONTOUR_DISPLAY_STYLE };

const store = createExternalStore<ContourDisplayState>(INITIAL);

/** Full snapshot (stable while unchanged — safe as a `useSyncExternalStore` getSnapshot). */
export function getContourDisplayState(): ContourDisplayState {
  return store.get();
}

/** Current default style newly generated contours inherit. */
export function getContourDisplayStyle(): ContourDisplayStyle {
  return store.get().style;
}

/** Switch the plan-view contour style (exact ↔ smooth). No-op if unchanged. */
export function setContourDisplayStyle(style: ContourDisplayStyle): void {
  const current = store.get();
  if (current.style === style) return;
  store.set({ ...current, style });
}

/** Subscribe to style changes; returns unsubscribe. */
export function subscribeContourDisplay(listener: () => void): () => void {
  return store.subscribe(listener);
}
