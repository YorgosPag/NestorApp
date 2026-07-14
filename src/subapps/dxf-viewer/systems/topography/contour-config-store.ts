/**
 * ADR-650 — ContourConfigStore: the contour-GENERATION parameters (interval,
 * index-every, base, labels) as a persistable SSoT.
 *
 * Civil 3D keeps the interval/index on the Surface Style — a persisted property of
 * the surface, not a transient dialog value. Until now these lived as component-local
 * React state in `TopographyPanel`, so they could be neither persisted nor reproduced
 * on reload. Extracting them to a vanilla store (mirror of `contour-display-store` /
 * `terrain-3d-store`) makes the whole contour definition a single source of truth the
 * topo persistence layer can save and the load path can regenerate from.
 *
 * Pattern: `createExternalStore` (ADR-040) — zero React state; the panel is a LOW-freq
 * `useSyncExternalStore` consumer (not a canvas orchestrator).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { DEFAULT_CONTOUR_CONFIG, type ContourConfig } from './contour-config';

const store = createExternalStore<ContourConfig>(DEFAULT_CONTOUR_CONFIG);

/** Full snapshot (safe as a `useSyncExternalStore` getSnapshot — stable while unchanged). */
export function getContourConfig(): ContourConfig {
  return store.get();
}

/** Minor contour interval in canonical mm (must be > 0). */
export function setContourIntervalMm(intervalMm: number): void {
  const next = Math.max(1, Number.isFinite(intervalMm) ? intervalMm : DEFAULT_CONTOUR_CONFIG.intervalMm);
  const current = store.get();
  if (current.intervalMm === next) return;
  store.set({ ...current, intervalMm: next });
}

/** Every N-th contour is a MAJOR (index) contour (must be >= 1). */
export function setContourMajorEvery(majorEvery: number): void {
  const next = Math.max(1, Math.round(Number.isFinite(majorEvery) ? majorEvery : DEFAULT_CONTOUR_CONFIG.majorEvery));
  const current = store.get();
  if (current.majorEvery === next) return;
  store.set({ ...current, majorEvery: next });
}

/**
 * Replace the WHOLE config (used by the persistence layer on load-restore). No-op if
 * structurally identical, so a hydrate that matches the current state stays silent.
 */
export function restoreContourConfig(config: ContourConfig): void {
  store.set({ ...config });
}

/** Subscribe to config changes; returns unsubscribe (useSyncExternalStore-compatible). */
export function subscribeContourConfig(listener: () => void): () => void {
  return store.subscribe(listener);
}
