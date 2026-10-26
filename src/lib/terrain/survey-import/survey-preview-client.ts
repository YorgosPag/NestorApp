/**
 * ADR-920 Β4.8 5γ — **the owner's terrain preview, off the main thread**: the Web Worker client, with the SAME handler on
 * the main thread as the safety net (no Worker · CSP · crash). Built on the one RPC of the app (`lib/workers`).
 *
 * 🔑 **`latestOnly`**: every column, unit or width change asks again — the running request finishes, the LATEST waits,
 *   the ones in between resolve `superseded` without reaching the Worker. No debounce delay, no queue of stale questions.
 *   (Not aborting the running one is deliberate: it is ≤ 0.5 s at the largest accepted survey (§13.8 5β), and killing the
 *   Worker would throw away the survey it keeps in memory.)
 * 🔑 **Zero-copy**: the packed points' buffer moves to the Worker (`transferOf`); a fresh buffer is packed per call.
 * 🔑 **Warm-up**: `warm()` spawns the Worker while the person still maps columns — the first preview pays no start-up.
 *
 * @related `survey-preview-host.ts` (the logic) · `survey-preview.worker.ts` · `survey-preview-worker-spawn.ts` ·
 *   `hooks/listings/useSurveyPreview.ts` (the caller)
 * @module lib/terrain/survey-import/survey-preview-client
 */

import { createWorkerRpcClient, latestOnly } from '@/lib/workers/worker-rpc-client';
import type { WorkerLike, WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import type { TopoPoint } from '../terrain-types';
import { createSurveyPreviewHost, type SurveyPreviewReply, type SurveyPreviewRequest } from './survey-preview-host';
import { packSurveyPoints } from './survey-preview-points';
import { spawnSurveyPreviewWorker } from './survey-preview-worker-spawn';

export interface SurveyPreviewQuestion {
  readonly key: number;
  readonly points: readonly TopoPoint[];
  readonly widthPx: number | null;
}

export interface SurveyPreviewer {
  readonly preview: (question: SurveyPreviewQuestion) => Promise<WorkerRpcResult<SurveyPreviewReply>>;
  /** Spawns the Worker ahead of the first question (idempotent; a no-op once spawned or on the safety net). */
  readonly warm: () => void;
  readonly dispose: () => void;
}

export interface SurveyPreviewerDeps {
  readonly spawn?: () => WorkerLike | null;
}

/** The warm-up request: an empty survey under a key no caller uses (keys start at 1). */
const WARM_UP: SurveyPreviewQuestion = { key: 0, points: [], widthPx: null };

/** **One previewer per form** — the Worker is born on first use and terminated by `dispose`. */
export function createSurveyPreviewer(deps: SurveyPreviewerDeps = {}): SurveyPreviewer {
  let fallbackHost: ReturnType<typeof createSurveyPreviewHost> | null = null;
  const client = createWorkerRpcClient<SurveyPreviewRequest, SurveyPreviewReply>({
    spawn: deps.spawn ?? spawnSurveyPreviewWorker,
    fallback: async (request) => (fallbackHost ??= createSurveyPreviewHost())(request),
    transferOf: (request) => [request.points.buffer],
  });
  const ask = latestOnly((request: SurveyPreviewRequest) => client.call(request));
  const requestOf = (question: SurveyPreviewQuestion): SurveyPreviewRequest => ({
    key: question.key, points: packSurveyPoints(question.points), widthPx: question.widthPx,
  });
  let warmed = false;
  return {
    preview: (question) => ask(requestOf(question)),
    warm: () => {
      if (warmed) return;
      warmed = true;
      void client.call(requestOf(WARM_UP));
    },
    dispose: client.dispose,
  };
}
