/**
 * ADR-920 Β4.8 5γ — **the birth of the preview Worker**: the only `new Worker(new URL(…, import.meta.url))` of the terrain
 * preview. A separate file so tests replace it without a bundler.
 *
 * 🔑 `null` instead of an error when the browser has no Worker: the client falls back to the SAME handler on the main thread.
 *
 * @module lib/terrain/survey-import/survey-preview-worker-spawn
 */

import type { WorkerLike } from '@/lib/workers/worker-rpc-protocol';

export function spawnSurveyPreviewWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./survey-preview.worker.ts', import.meta.url), { type: 'module', name: 'survey-preview' });
}
