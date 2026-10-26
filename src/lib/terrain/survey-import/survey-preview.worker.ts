/**
 * ADR-920 Β4.8 5γ — **the Web Worker of the owner's terrain preview**: a thin wrapper — the door's verdict and the map,
 * both off the main thread.
 * @related `survey-preview-host.ts` (all the logic — pure, tested without a Worker) · `survey-preview-worker-spawn.ts` (the
 *   ONLY place that starts it) · `lib/workers/worker-rpc-host.ts` (the RPC)
 * @module lib/terrain/survey-import/survey-preview.worker
 *
 * ⚠️ No React / DOM / stores: pure `lib` only (the doctrine of every Worker of the app, ADR-639 · ADR-884 §4.14).
 */

import { serveWorkerRpc } from '@/lib/workers/worker-rpc-host';

import { createSurveyPreviewHost } from './survey-preview-host';

serveWorkerRpc(self, createSurveyPreviewHost());

// Empty export: the file stays a module under `isolatedModules`.
export {};
