/**
 * Dxf3dStreamProgressStore — micro-leaf progress SSoT for the 3D DXF text streaming
 * build (ADR-645 Φάση A).
 *
 * Zero React state, mutable singleton with `useSyncExternalStore`-compatible
 * subscribe/getSnapshot (same ADR-040 micro-leaf pattern as `HoverStore` /
 * `ImmediatePositionStore`). The `DxfToThreeConverter` (the owner of the incremental
 * build, ADR-645 §5) writes progress here; the `Dxf3dStreamProgressLeaf` overlay is the
 * ONLY subscriber, so streaming progress never cascades a re-render through the viewport.
 *
 * `getSnapshot` returns a STABLE object reference between notifications (a new object is
 * minted only on an actual state change) so `useSyncExternalStore` never tears.
 *
 * @module bim-3d/stores/Dxf3dStreamProgressStore
 */

import { createExternalStore } from '../../stores/createExternalStore';

/** Immutable snapshot of the streaming build progress. */
export interface Dxf3dStreamProgress {
  /** Text meshes built so far. */
  readonly done: number;
  /** Total text meshes to build this run. */
  readonly total: number;
  /** True while an incremental build is in flight (drives overlay visibility). */
  readonly active: boolean;
}

const IDLE: Dxf3dStreamProgress = { done: 0, total: 0, active: false };

/** SSoT pub/sub cell (ADR-040 micro-leaf· createExternalStore WAVE 3). `equals` keeps the
 *  snapshot reference STABLE across identical writes so `useSyncExternalStore` never tears. */
const store = createExternalStore<Dxf3dStreamProgress>(IDLE, {
  equals: (a, b) => a.active === b.active && a.done === b.done && a.total === b.total,
});

/** Publish streaming progress (marks the build active). No-op if unchanged (avoids tearing churn). */
export function setDxf3dStreamProgress(done: number, total: number): void {
  store.set({ done, total, active: true });
}

/** Clear progress — the overlay hides. Idempotent (no-op when already idle). */
export function clearDxf3dStreamProgress(): void {
  store.set(IDLE);
}

/** Snapshot getter (stable reference between notifications) for `useSyncExternalStore`. */
export function getDxf3dStreamProgress(): Dxf3dStreamProgress {
  return store.get();
}

/** Server / initial snapshot — always idle (streaming is a client-only, post-mount build). */
export function getDxf3dStreamServerSnapshot(): Dxf3dStreamProgress {
  return IDLE;
}

/** Subscribe for `useSyncExternalStore`. Returns the unsubscribe handle. */
export function subscribeDxf3dStreamProgress(cb: () => void): () => void {
  return store.subscribe(cb);
}
