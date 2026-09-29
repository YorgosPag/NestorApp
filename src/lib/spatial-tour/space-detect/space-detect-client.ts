/**
 * @fileoverview **Ο ΑΝΙΧΝΕΥΤΗΣ ΧΩΡΩΝ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — προθέρμανση κάτοψης και ανίχνευση σε μέτρα, στον Web Worker, με δίχτυ τον
 * **ίδιο** κώδικα στον κύριο νήμα (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14 · §12 Δ8.1).
 * @related `space-detect-host.ts` (η λογική) · `space-detect-worker-spawn.ts` (ο Worker) · `lib/workers/worker-rpc-client.ts` ·
 *   `components/spatial-tour/editor/useSpaceDetector.ts` (ο καλών)
 * @module lib/spatial-tour/space-detect/space-detect-client
 *
 * 🔑 **Η ανίχνευση είναι `latestOnly`**: κλικ σε κλικ ή το ρυθμιστικό πόρτας στέλνουν πολλές ερωτήσεις — τρέχει η τρέχουσα και η
 *   **τελευταία**· οι ενδιάμεσες λύνονται `superseded` χωρίς να αγγίξουν τον Worker. Η φόρτωση **δεν** προσπερνιέται ποτέ.
 * 🔒 **Πάντα ΠΡΟΤΑΣΗ** (Δ8.1): τίποτα εδώ δεν γράφει — ο άνθρωπος εγκρίνει στον επεξεργαστή.
 */

import { fetchImagePixels } from '@/lib/media/image-pixels';
import { createWorkerRpcClient, latestOnly } from '@/lib/workers/worker-rpc-client';
import type { WorkerLike, WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';

import { createSpaceDetectHost, type SpaceDetectMessage, type SpaceDetectReply } from './space-detect-host';
import type { PlanDetectRequest, PlanDetectResult } from './space-detect-plan';
import { spawnSpaceDetectWorker } from './space-detect-worker-spawn';

export interface SpaceDetector {
  /** Προθέρμανση: λήψη + αποκωδικοποίηση + μάσκα μελανιού, **πριν** το πρώτο κλικ. */
  readonly load: (url: string) => Promise<WorkerRpcResult<{ readonly width: number; readonly height: number }>>;
  readonly detect: (url: string, request: PlanDetectRequest) => Promise<WorkerRpcResult<PlanDetectResult>>;
  readonly dispose: () => void;
}

export interface SpaceDetectorDeps {
  readonly spawn?: () => WorkerLike | null;
  /** Ο χειριστής του διχτυού (κύριος νήμας) — ο ίδιος host με τον Worker, με τον πραγματικό αποκωδικοποιητή. */
  readonly fallback?: (message: SpaceDetectMessage) => Promise<SpaceDetectReply>;
}

const unexpected = (reply: SpaceDetectReply): WorkerRpcResult<never> => ({ kind: 'failed', error: `space-detect-unexpected-${reply.kind}` });

/** Η απάντηση της φόρτωσης — άλλο είδος απάντησης = βλάβη του συμβολαίου (ποτέ σιωπηλή). */
function loadedOf(result: WorkerRpcResult<SpaceDetectReply>): WorkerRpcResult<{ readonly width: number; readonly height: number }> {
  if (result.kind !== 'ok') return result;
  const reply = result.value;
  return reply.kind === 'loaded' ? { kind: 'ok', value: { width: reply.width, height: reply.height } } : unexpected(reply);
}

function detectedOf(result: WorkerRpcResult<SpaceDetectReply>): WorkerRpcResult<PlanDetectResult> {
  if (result.kind !== 'ok') return result;
  const reply = result.value;
  return reply.kind === 'detected' ? { kind: 'ok', value: reply.result } : unexpected(reply);
}

/** **Ένας ανιχνευτής ανά επεξεργαστή** — ο Worker γεννιέται στην πρώτη κλήση και τερματίζεται στο `dispose`. */
export function createSpaceDetector(deps: SpaceDetectorDeps = {}): SpaceDetector {
  let fallbackHost: ((message: SpaceDetectMessage) => Promise<SpaceDetectReply>) | null = null;
  const fallback = deps.fallback ?? ((message: SpaceDetectMessage) => {
    fallbackHost ??= createSpaceDetectHost((url) => fetchImagePixels(url));
    return fallbackHost(message);
  });
  const client = createWorkerRpcClient<SpaceDetectMessage, SpaceDetectReply>({ spawn: deps.spawn ?? spawnSpaceDetectWorker, fallback });
  const detectLatest = latestOnly((message: SpaceDetectMessage) => client.call(message));
  return {
    load: async (url) => loadedOf(await client.call({ kind: 'load', url })),
    detect: async (url, request) => detectedOf(await detectLatest({ kind: 'detect', url, request })),
    dispose: client.dispose,
  };
}
