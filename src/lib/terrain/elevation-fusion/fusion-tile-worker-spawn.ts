/**
 * ADR-920 §14.12 Β4 — **the birth of the fusion Worker**: the only `new Worker(new URL(…, import.meta.url))` of the
 * elevation fusion. A separate file so tests replace it without a bundler.
 *
 * 🔑 `null` instead of an error when this browser cannot run the mosaic in a Worker — no `Worker`, or no
 * `OffscreenCanvas` (a Worker has no other canvas to decode the coarse tiles with). The client then falls back to the
 * SAME handler on the main thread.
 *
 * @module lib/terrain/elevation-fusion/fusion-tile-worker-spawn
 */

import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

export function spawnFusionTileWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  return new Worker(new URL('./fusion-tile.worker.ts', import.meta.url), { type: 'module', name: 'terrain-fusion' });
}
