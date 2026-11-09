/**
 * **Ο ευθυγραμμιστής κάτοψης του πελάτη** (ADR-929 Φ1, Δ6) — ευθυγράμμιση (και, αν ζητηθούν, τα τμήματα της Φ2 στο
 * **ίδιο** ταξίδι) στον Web Worker, με δίχτυ τον **ίδιο** κώδικα στον κύριο νήμα (μοτίβο του `space-detect-client.ts`,
 * πάνω στο ΕΝΑ RPC του `lib/workers`).
 *
 * 🔑 **Zero-copy και στις δύο κατευθύνσεις**: η εικόνα πηγαίνει με `transfer` και η ευθυγραμμισμένη γυρίζει με `transfer`.
 *   ⚠️ Μετά την κλήση το `raster.rgba` του καλούντα είναι **άδειο** — δίνεις νέο buffer ανά κλήση (π.χ. ένα φρέσκο
 *   `getImageData`).
 * 🔑 **`latestOnly`**: όταν ο χρήστης σέρνει τις 4 γωνίες της προοπτικής, κάθε κίνηση ζητά νέα ευθυγράμμιση — τρέχει η
 *   τρέχουσα και η **τελευταία**· οι ενδιάμεσες λύνονται `superseded` χωρίς να σταλούν (και χωρίς να αποσπαστεί το buffer τους).
 * 🔑 **Επανεξαγωγή τμημάτων (ADR-929 §6.10 Α2)**: το `extractSegments` στέλνει **αντίγραφο** της μάσκας μελανιού (το
 *   πρωτότυπο μένει στο store) μαζί με τη μάσκα της όψης· δικό του `latestOnly`.
 * 🔒 **Πάντα πρόταση**: τίποτα εδώ δεν γράφει στη σκηνή ή στον διακομιστή (ADR-929 αρχή 1).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-align-client
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { createWorkerRpcClient, latestOnly } from '@/lib/workers/worker-rpc-client';
import type { WorkerLike, WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';
import {
  handlePlanWorker,
  isPlanAlignReply,
  isPlanSegmentsReply,
  isPlanViewRenderReply,
  planAlignRequestTransfer,
  type PlanAlignMessage,
  type PlanAlignReply,
  type PlanSegmentRequest,
  type PlanSegmentsMessage,
  type PlanSegmentsReply,
  type PlanViewRenderMessage,
  type PlanViewRenderReply,
  type PlanWorkerMessage,
  type PlanWorkerReply,
} from './plan-align-host';
import type { PlanAlignOptions } from './plan-alignment-types';
import { spawnPlanAlignWorker } from './plan-align-worker-spawn';

export interface PlanAlignRequest {
  readonly options?: Partial<PlanAlignOptions>;
  /** Παρόν ⇒ και τα τμήματα της Φ2 στην ίδια απάντηση (όχι όσο σέρνονται οι γωνίες: κοστίζουν). */
  readonly segments?: PlanSegmentRequest;
}

/** ADR-929 Φ5.3β — ό,τι χρειάζεται η απόδοση της όψης (χωρίς `kind`: το βάζει ο πελάτης). */
export type PlanViewRenderRequest = Omit<PlanViewRenderMessage, 'kind'>;

/** ADR-929 §6.10 Α2 — η επανεξαγωγή τμημάτων (χωρίς `kind`). Το `source.ink` το αντιγράφει ο πελάτης πριν φύγει. */
export type PlanSegmentsRequest = Omit<PlanSegmentsMessage, 'kind'>;

export interface PlanAligner {
  readonly align: (raster: PlanRaster, request?: PlanAlignRequest) => Promise<WorkerRpcResult<PlanAlignReply>>;
  /**
   * ADR-929 Φ5.3β — τα bytes της όψης (PNG) στον **ίδιο** Worker. Δικό του `latestOnly`: ένα δεύτερο «Έλεγχος» πριν
   * τελειώσει το πρώτο αντικαθιστά το αναμένον, χωρίς να ακυρώσει μια ευθυγράμμιση.
   */
  readonly renderView: (request: PlanViewRenderRequest) => Promise<WorkerRpcResult<PlanViewRenderReply>>;
  /** ADR-929 §6.10 Α2 — τα τμήματα με τη μάσκα της όψης, στον **ίδιο** Worker, χωρίς να ξαναπάει η εικόνα. */
  readonly extractSegments: (request: PlanSegmentsRequest) => Promise<WorkerRpcResult<PlanSegmentsReply>>;
  readonly dispose: () => void;
}

export interface PlanAlignerDeps {
  readonly spawn?: () => WorkerLike | null;
  readonly fallback?: (message: PlanWorkerMessage) => Promise<PlanWorkerReply>;
}

/** Στενεύει μια απάντηση του ενός RPC στο είδος που ζητήθηκε· άλλο είδος = σφάλμα πρωτοκόλλου, ποτέ σιωπή. */
function narrowReply<R extends PlanWorkerReply>(
  result: WorkerRpcResult<PlanWorkerReply>,
  is: (reply: PlanWorkerReply) => reply is R,
): WorkerRpcResult<R> {
  if (result.kind !== 'ok') return result;
  return is(result.value) ? { kind: 'ok', value: result.value } : { kind: 'failed', error: 'plan-worker-reply-mismatch' };
}

/** **Ένας ευθυγραμμιστής ανά επεξεργαστή** — ο Worker γεννιέται στην πρώτη κλήση και τερματίζεται στο `dispose`. */
export function createPlanAligner(deps: PlanAlignerDeps = {}): PlanAligner {
  const client = createWorkerRpcClient<PlanWorkerMessage, PlanWorkerReply>({
    spawn: deps.spawn ?? spawnPlanAlignWorker,
    fallback: deps.fallback ?? handlePlanWorker,
    transferOf: planAlignRequestTransfer,
  });
  const alignLatest = latestOnly((message: PlanAlignMessage) => client.call(message));
  const renderLatest = latestOnly((message: PlanViewRenderMessage) => client.call(message));
  const segmentsLatest = latestOnly((message: PlanSegmentsMessage) => client.call(message));
  return {
    align: async (raster, request = {}) => narrowReply(await alignLatest({ kind: 'align', raster, ...request }), isPlanAlignReply),
    renderView: async (request) => narrowReply(await renderLatest({ kind: 'render-view', ...request }), isPlanViewRenderReply),
    extractSegments: async ({ source, mask, request }) => {
      // Αντίγραφο: το buffer μετακομίζει (transfer) και το store κρατά το δικό του.
      const message: PlanSegmentsMessage = { kind: 'segments', source: { ...source, ink: source.ink.slice() }, mask, request };
      return narrowReply(await segmentsLatest(message), isPlanSegmentsReply);
    },
    dispose: client.dispose,
  };
}
