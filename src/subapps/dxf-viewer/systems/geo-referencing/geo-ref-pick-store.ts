/**
 * ADR-650 M10 — manual common-point PICK session (Revit «Specify Coordinates at Point»).
 *
 * Bridges the canvas pick tool (`geo-ref-anchor`) to the geo-referencing panel. The user
 * arms a slot in the panel, clicks a KNOWN point on the plan (snapped), and the click
 * handler writes the LOCAL DXF coordinate (canonical mm) into that slot. The panel then
 * asks for the point's real ΕΓΣΑ coordinate and composes the transform:
 *   - slot 0 alone → translation (1 point, `fromOnePointPair`)
 *   - slots 0 + 1  → translation + rotation (2 points, `fromTwoPointPairs`)
 *
 * Zero React state (createExternalStore, ADR-040). The world coordinate the user TYPES
 * lives in the panel's own React state — this store only carries the canvas-picked LOCAL
 * points + which slot is armed for the next click.
 *
 * @see ../../hooks/canvas/canvas-click-geo-ref.ts — the click handler (writes local pts)
 * @see ../../ui/panels/topography/TopoGeoReferenceSection.tsx — the panel consumer
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { Point2D } from '../../rendering/types/Types';

export type GeoRefPickSlot = 0 | 1;

export interface GeoRefPickState {
  /** Canvas-picked LOCAL points (canonical mm); `null` = not yet picked. */
  readonly points: readonly [Point2D | null, Point2D | null];
  /** The slot the next canvas click fills, or `null` when not capturing. */
  readonly armedSlot: GeoRefPickSlot | null;
}

const INITIAL: GeoRefPickState = { points: [null, null], armedSlot: null };

const store = createExternalStore<GeoRefPickState>(INITIAL);

export function getGeoRefPickState(): GeoRefPickState {
  return store.get();
}

export function subscribeGeoRefPick(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Arm a slot so the next canvas click writes its LOCAL point there. */
export function armGeoRefPick(slot: GeoRefPickSlot): void {
  store.set({ ...store.get(), armedSlot: slot });
}

/** Cancel any armed capture without clearing already-picked points. */
export function disarmGeoRefPick(): void {
  const cur = store.get();
  if (cur.armedSlot === null) return;
  store.set({ ...cur, armedSlot: null });
}

/**
 * Write a canvas-picked LOCAL point into the armed slot (one-shot — disarms after).
 * No-op when no slot is armed. Called by the `geo-ref-anchor` click handler.
 */
export function captureGeoRefPick(local: Point2D): void {
  const cur = store.get();
  if (cur.armedSlot === null) return;
  const points: [Point2D | null, Point2D | null] = [cur.points[0], cur.points[1]];
  points[cur.armedSlot] = local;
  store.set({ points, armedSlot: null });
}

/** Reset the whole pick session (both points + armed slot). */
export function clearGeoRefPicks(): void {
  store.set(INITIAL);
}
