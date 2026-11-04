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
 * 🔒 **Πάντα πρόταση**: τίποτα εδώ δεν γράφει στη σκηνή ή στον διακομιστή (ADR-929 αρχή 1).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-align-client
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { createWorkerRpcClient, latestOnly } from '@/lib/workers/worker-rpc-client';
import type { WorkerLike, WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';
import {
  handlePlanAlign,
  planAlignRequestTransfer,
  type PlanAlignMessage,
  type PlanAlignReply,
  type PlanSegmentRequest,
} from './plan-align-host';
import type { PlanAlignOptions } from './plan-alignment-types';
import { spawnPlanAlignWorker } from './plan-align-worker-spawn';

export interface PlanAlignRequest {
  readonly options?: Partial<PlanAlignOptions>;
  /** Παρόν ⇒ και τα τμήματα της Φ2 στην ίδια απάντηση (όχι όσο σέρνονται οι γωνίες: κοστίζουν). */
  readonly segments?: PlanSegmentRequest;
}

export interface PlanAligner {
  readonly align: (raster: PlanRaster, request?: PlanAlignRequest) => Promise<WorkerRpcResult<PlanAlignReply>>;
  readonly dispose: () => void;
}

export interface PlanAlignerDeps {
  readonly spawn?: () => WorkerLike | null;
  readonly fallback?: (message: PlanAlignMessage) => Promise<PlanAlignReply>;
}

/** **Ένας ευθυγραμμιστής ανά επεξεργαστή** — ο Worker γεννιέται στην πρώτη κλήση και τερματίζεται στο `dispose`. */
export function createPlanAligner(deps: PlanAlignerDeps = {}): PlanAligner {
  const client = createWorkerRpcClient<PlanAlignMessage, PlanAlignReply>({
    spawn: deps.spawn ?? spawnPlanAlignWorker,
    fallback: deps.fallback ?? (async (message) => handlePlanAlign(message)),
    transferOf: planAlignRequestTransfer,
  });
  const alignLatest = latestOnly((message: PlanAlignMessage) => client.call(message));
  return {
    align: (raster, request = {}) => alignLatest({ kind: 'align', raster, ...request }),
    dispose: client.dispose,
  };
}
