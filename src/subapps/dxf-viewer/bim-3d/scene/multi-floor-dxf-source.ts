/**
 * multi-floor-dxf-source — non-React SSoT for the per-floor DXF wireframe stack
 * shown by the «Όλοι οι όροφοι» (all floors) 3D scope.
 *
 * ADR-399 Phase B. Sibling of {@link multi-floor-3d-source} (which carries BIM
 * entities); this one carries the flat DXF floor-plan underlay per floor so the
 * 3D view stacks every floor's plan at its datum-relative elevation alongside
 * the stacked BIM geometry. Plain module store (zero React state) so the
 * scope-aware `resyncDxfOverlay` SSoT — called from non-React store subscribers
 * — can read the current stack synchronously.
 *
 * Producer: `useFloors3DDxfOverlay`. Consumer: `resyncDxfOverlay` →
 * `ThreeJsSceneManager.syncDxfOverlayMultiFloor`.
 */

import type { DxfOverlayFloorEntry } from '../converters/DxfToThreeConverter';
import { createExternalStore } from '../../stores/createExternalStore';

export interface DxfFloorStackEntry extends DxfOverlayFloorEntry {
  /** Linked DXF level id (provenance / future per-floor gating). */
  readonly levelId: string;
}

// Identity-guarded store (`equals: Object.is` = το παλιό `if (next === stack) return`).
const store = createExternalStore<readonly DxfFloorStackEntry[]>([], { equals: Object.is });

/** Current aggregated DXF floor stack (empty unless scope === 'all'). */
export function getMultiFloorDxfStack(): readonly DxfFloorStackEntry[] {
  return store.get();
}

/** Replace the stack and notify subscribers (idempotent on identity). */
export function setMultiFloorDxfStack(next: readonly DxfFloorStackEntry[]): void {
  store.set(next);
}

/** Subscribe to stack replacements. Returns an unsubscribe fn. */
export function subscribeMultiFloorDxfStack(fn: () => void): () => void {
  return store.subscribe(fn);
}
