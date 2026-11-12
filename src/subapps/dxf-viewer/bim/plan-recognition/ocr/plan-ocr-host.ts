/**
 * =============================================================================
 * Η ΑΝΑΓΝΩΣΗ ΚΕΙΜΕΝΩΝ ΠΙΣΩ ΑΠΟ ΤΟ RPC (ADR-929 Φ0.4)
 * =============================================================================
 *
 * Ό,τι τρέχει μέσα στον Web Worker του OCR: φόρτωση των μοντέλων **μία φορά** ανά Worker, μετά ο κινητήρας
 * (`recognizePlanText`) σε κάθε αίτημα, με την ακύρωση και την πρόοδο του κοινού RPC (`lib/workers`).
 *
 * 🔑 **Φόρτωση μία φορά, αποτυχία όχι για πάντα**: τα μοντέλα κρατιούνται ως υπόσχεση· αν η φόρτωση αποτύχει (δίκτυο,
 *   αποτύπωμα, ακύρωση στη μέση) η υπόσχεση ξεχνιέται και το επόμενο αίτημα ξαναδοκιμάζει (το Cache Storage κρατά ό,τι
 *   πρόλαβε να επαληθευτεί). Το σειριακό RPC εγγυάται ότι δύο φορτώσεις δεν τρέχουν ποτέ ταυτόχρονα.
 * 🔑 **Καθαρό από DOM**: το `load` εγχέεται (`createPlanOcrHost`) ⇒ ο χειριστής δοκιμάζεται χωρίς WASM και χωρίς δίκτυο.
 * ⛔ **Κανένα δίχτυ στον κύριο νήμα**: OCR λεπτών εκεί θα πάγωνε τη σελίδα — ο πελάτης απαντά `failed: worker-unavailable`.
 *
 * @module bim/plan-recognition/ocr/plan-ocr-host
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { WorkerRpcContext, WorkerRpcHandler } from '@/lib/workers/worker-rpc-protocol';
import { recognizePlanText, type OcrModels, type OcrProgress, type OcrText } from './ocr-engine';
import type { OcrLoadContext, OcrLoadProgress } from './ocr-onnx-runtime';

export interface PlanOcrRequest {
  /** Η **αρχική** εικόνα του υποβάθρου, νέο buffer (μετακομίζει στον Worker). */
  readonly raster: PlanRaster;
  /** Σταθερός συντελεστής μείωσης (`OcrEngineOptions.downscale`)· χωρίς τιμή ⇒ από το ύψος γραμμάτων (§6.16 βήμα 3). */
  readonly downscale?: number;
  /** Απόλυτη βάση της σελίδας για τα URL των μοντέλων (λυμένη στον κύριο νήμα — `absoluteWorkerUrl`). */
  readonly assetBase: string;
}

export interface PlanOcrReply {
  /** Σε συνεχή raster-px της **αρχικής** εικόνας, σειρά ανάγνωσης κορυφών (`OcrText`). */
  readonly texts: readonly OcrText[];
  /** Ο συντελεστής με τον οποίο ανιχνεύθηκαν (διάγνωση· ADR-929 §6.16). */
  readonly downscale: number;
}

/** Φόρτωση μοντέλων → ανίχνευση → ανάγνωση. */
export type PlanOcrProgress = OcrLoadProgress | OcrProgress;

export type PlanOcrModelLoader = (base: string, context: OcrLoadContext) => Promise<OcrModels>;

/** Ο χειριστής του Worker, με τη μνήμη των μοντέλων του. */
export function createPlanOcrHost(load: PlanOcrModelLoader): WorkerRpcHandler<PlanOcrRequest, PlanOcrReply, PlanOcrProgress> {
  let models: Promise<OcrModels> | null = null;
  const ready = (base: string, context: WorkerRpcContext<PlanOcrProgress>): Promise<OcrModels> => {
    if (models === null) {
      const attempt = load(base, { signal: context.signal, onProgress: context.progress });
      models = attempt;
      attempt.catch(() => { if (models === attempt) models = null; });
    }
    return models;
  };
  return async (request, context) => {
    const loaded = await ready(request.assetBase, context);
    return recognizePlanText(request.raster, loaded, {
      downscale: request.downscale, signal: context.signal, onProgress: context.progress,
    });
  };
}

/** Η εικόνα μετακομίζει στον Worker (ο καλών δίνει **νέο** buffer ανά κλήση). Η απάντηση είναι μικρή: αντιγράφεται. */
export function planOcrRequestTransfer(request: PlanOcrRequest): Transferable[] {
  return [request.raster.rgba.buffer];
}
