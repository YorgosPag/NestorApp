/**
 * ADR-639 Στάδιο 5 — WebGL line-layer activation store (module-level SSoT).
 *
 * ONE boolean owns whether the GPU line layer is live. It gates the whole feature:
 *   • large-scene threshold (WEBGL_LINE_LAYER_MIN_ENTITIES) at build time,
 *   • WebGL-unavailable / context-lost fallback,
 *   • a reduced-capability feature flag.
 * The DxfRenderer reads `isWebglLineLayerActive()` as an EVENT-TIME getter (never a
 * React snapshot → never stale, ADR-040 rule 2) to decide whether to suppress its
 * Canvas2D line strokes.
 *
 * On every toggle we `markSystemsDirty(['dxf-canvas'])`: OFF→the Canvas2D renderer
 * must re-stroke the lines the GPU had owned; ON→it must suppress them. Routing that
 * through the ONE UnifiedFrameScheduler SSoT (never a private rAF) keeps the two
 * layers in lock-step — never a frame where a line is drawn twice or by neither.
 *
 * Zero React state; the pub/sub cell is the shared createExternalStore SSoT (never a
 * hand-rolled listener set, N.0/ADR-294) so the imperative manager and the thin leaf can
 * both react via `useSyncExternalStore` on this low-frequency signal. `Object.is` equals →
 * a redundant write is a no-op (no notify, no dirty-mark).
 *
 * @see canvas-v2/dxf-canvas/dxf-canvas-renderer.ts:411 — the 'dxf-canvas' system id
 * @see canvas-v2/webgl-lines/is-webgl-owned-line.ts — the ownership gate the flag arms
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { markSystemsDirty } from '../../rendering/core/frame-scheduler-api';

/** Frame-scheduler system id for the new WebGL line canvas (registered by the leaf, STEP 10). */
export const WEBGL_LINE_CANVAS_SYSTEM_ID = 'webgl-line-canvas';

/** The existing Canvas2D DXF entity renderer's system id (dxf-canvas-renderer.ts:411). */
const DXF_CANVAS_SYSTEM_ID = 'dxf-canvas';

const activeStore = createExternalStore<boolean>(false, { equals: Object.is });

/** Event-time getter — the DxfRenderer reads this per frame to gate line suppression. */
export function isWebglLineLayerActive(): boolean {
  return activeStore.get();
}

/**
 * Set the layer active/inactive. Idempotent — a no-op when unchanged. On a real
 * change it marks the Canvas2D renderer dirty (so it repaints with/without the GPU
 * lines) BEFORE the store notifies subscribers — the identity check here gates the
 * dirty-mark side effect, while the store's `Object.is` equals gates the notify.
 */
export function setWebglLineLayerActive(next: boolean): void {
  if (activeStore.get() === next) return;
  markSystemsDirty([DXF_CANVAS_SYSTEM_ID]);
  activeStore.set(next);
}

/** Subscribe to activation changes. Returns an unsubscribe. */
export function subscribeWebglLineLayerActive(callback: () => void): () => void {
  return activeStore.subscribe(callback);
}
