/**
 * =============================================================================
 * Ο ΑΝΑΓΝΩΣΤΗΣ ΚΕΙΜΕΝΩΝ ΚΑΤΟΨΗΣ ΤΟΥ ΠΕΛΑΤΗ (ADR-929 Φ0.4)
 * =============================================================================
 *
 * Η τοπική ανάγνωση κειμένων (OCR) στον Web Worker, πάνω στο ΕΝΑ RPC του `lib/workers` (μοτίβο του `plan-align-client.ts`).
 * Τίποτα δεν φεύγει από τον browser πέρα από τη λήψη των μοντέλων από τον δικό μας διακομιστή.
 *
 * 🔑 **Ακύρωση + πρόοδος**: `read(raster, { signal, onProgress })` — στο `abort` λύνεται αμέσως `cancelled` και ο Worker
 *   σταματά πριν από την επόμενη κλήση μοντέλου· η πρόοδος περνά τα στάδια `load` → `detect` → `read`.
 * 🔑 **`latestOnly`**: το πολύ μία ανάγνωση σε πτήση και μία αναμένουσα· μια νεότερη αντικαθιστά την αναμένουσα
 *   (`superseded`). Τη σε πτήση τη σταματά **μόνο** το `signal` του καλούντα.
 * 🔑 **Τερματισμός μετά από αδράνεια** (`PLAN_OCR_IDLE_MS`): η μνήμη του WASM (~μοντέλα + σωροί) δεν επιστρέφεται ποτέ
 *   όσο ζει ο Worker — μάθημα YuNet. Η επόμενη ανάγνωση τον ξαναγεννά· τα μοντέλα έρχονται από το Cache Storage.
 * ⛔ **Κανένα δίχτυ στον κύριο νήμα**: λεπτά CPU εκεί θα πάγωναν τη σελίδα ⇒ χωρίς Worker η απάντηση είναι
 *   `failed: worker-unavailable`, ρητά.
 * ⚠️ **Zero-copy**: μετά την κλήση το `raster.rgba` του καλούντα είναι **άδειο** — δίνεις νέο buffer ανά κλήση.
 * 🔒 **Πάντα πρόταση**: τίποτα εδώ δεν γράφει στη σκηνή ή στον διακομιστή (ADR-929 αρχή 1).
 *
 * @module bim/plan-recognition/ocr/plan-ocr-client
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { DXF_TIMING } from '../../../config/dxf-timing';
import { createWorkerRpcClient, latestOnly } from '@/lib/workers/worker-rpc-client';
import {
  absoluteWorkerUrl,
  type WorkerLike,
  type WorkerRpcCallOptions,
  type WorkerRpcCancellableResult,
} from '@/lib/workers/worker-rpc-protocol';
import { planOcrRequestTransfer, type PlanOcrProgress, type PlanOcrReply, type PlanOcrRequest } from './plan-ocr-host';
import { spawnPlanOcrWorker } from './plan-ocr-worker-spawn';

/** Μετά από τόση αδράνεια ο Worker τερματίζεται (SSoT: `DXF_TIMING.lifecycle.OCR_WORKER_IDLE`). */
export const PLAN_OCR_IDLE_MS = DXF_TIMING.lifecycle.OCR_WORKER_IDLE;

export interface PlanOcrReadOptions extends WorkerRpcCallOptions<PlanOcrProgress> {
  /** Ακέραιος συντελεστής μείωσης πριν την ανίχνευση (`1` = πλήρης ανάλυση). */
  readonly downscale: number;
}

export interface PlanOcrReader {
  readonly read: (raster: PlanRaster, options: PlanOcrReadOptions) => Promise<WorkerRpcCancellableResult<PlanOcrReply>>;
  readonly dispose: () => void;
}

export interface PlanOcrReaderDeps {
  readonly spawn?: () => WorkerLike | null;
  readonly idleTimeoutMs?: number;
}

interface PlanOcrCall {
  readonly request: PlanOcrRequest;
  readonly options: WorkerRpcCallOptions<PlanOcrProgress>;
}

/** **Ένας αναγνώστης ανά επεξεργαστή** — ο Worker γεννιέται στην πρώτη ανάγνωση και τερματίζεται στην αδράνεια ή στο `dispose`. */
export function createPlanOcrReader(deps: PlanOcrReaderDeps = {}): PlanOcrReader {
  const client = createWorkerRpcClient<PlanOcrRequest, PlanOcrReply, PlanOcrProgress>({
    spawn: deps.spawn ?? spawnPlanOcrWorker,
    transferOf: planOcrRequestTransfer,
    idleTimeoutMs: deps.idleTimeoutMs ?? PLAN_OCR_IDLE_MS,
  });
  const readLatest = latestOnly((call: PlanOcrCall) => client.run(call.request, call.options));
  return {
    read: (raster, { downscale, signal, onProgress }) =>
      readLatest({ request: { raster, downscale, assetBase: absoluteWorkerUrl('/') }, options: { signal, onProgress } }),
    dispose: client.dispose,
  };
}
