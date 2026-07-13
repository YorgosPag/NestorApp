/**
 * ADR-650 M4 — Terrain3DStore: the DISPLAY state of the topographic surface in 3D.
 *
 * Deliberately separate from `TopoPointStore`: that one owns the survey DEFINITION (the
 * data), this one owns how the derived surface is DISPLAYED (Civil 3D's Surface ↔ Surface
 * Style split). Toggling the hill off must never touch the survey, and re-styling it must
 * never re-trigger a data write.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040), mirroring `TopoPointStore` —
 * zero React state; the 3D layer subscribes imperatively, the panel via
 * `useSyncExternalStore` (LOW-freq consumer, not a canvas orchestrator).
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TerrainSurfaceStyle } from './topo-types';

export interface Terrain3DState {
  /** Is the terrain mesh drawn in the 3D viewport? Off by default — the user opts in. */
  readonly visible: boolean;
  readonly style: TerrainSurfaceStyle;
}

const INITIAL: Terrain3DState = { visible: false, style: 'shaded' };

const store = createExternalStore<Terrain3DState>(INITIAL);

/** Full snapshot (safe as a `useSyncExternalStore` getSnapshot — stable while unchanged). */
export function getTerrain3DState(): Terrain3DState {
  return store.get();
}

/** Show / hide the terrain mesh in 3D. */
export function setTerrain3DVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Switch the surface style (flat earth ↔ elevation banding). Triangulation is untouched. */
export function setTerrain3DStyle(style: TerrainSurfaceStyle): void {
  const current = store.get();
  if (current.style === style) return;
  store.set({ ...current, style });
}

/** Subscribe to display-state changes; returns unsubscribe. */
export function subscribeTerrain3D(listener: () => void): () => void {
  return store.subscribe(listener);
}
