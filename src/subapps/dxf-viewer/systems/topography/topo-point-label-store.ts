/**
 * ADR-656 M10 — PointLabelStore: WHICH survey-point fields are drawn on the plan.
 *
 * The 2D sibling of `contour-display-store` / `terrain-3d-store` (Civil 3D's Surface ↔
 * Surface-Style split): the survey definition is untouched, this only owns the PRESENTATION
 * choice — spot Ζ, point number/code, boundary X,Y. The panel toggles reflect/set it and the
 * `useTopoPointLabels` generate reads it.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040) — zero React state; the panel
 * subscribes via `useSyncExternalStore` (LOW-freq, not a canvas orchestrator).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_POINT_LABEL_OPTS, type PointLabelOptions } from './topo-point-label-config';

const store = createExternalStore<PointLabelOptions>(DEFAULT_POINT_LABEL_OPTS);

/** Full snapshot (stable while unchanged — safe as a `useSyncExternalStore` getSnapshot). */
export function getPointLabelOptions(): PointLabelOptions {
  return store.get();
}

/** Flip one label toggle. No-op if the value is unchanged. */
export function setPointLabelOption(key: keyof PointLabelOptions, value: boolean): void {
  const current = store.get();
  if (current[key] === value) return;
  store.set({ ...current, [key]: value });
}

/** Subscribe to option changes; returns unsubscribe. */
export function subscribePointLabelOptions(listener: () => void): () => void {
  return store.subscribe(listener);
}
