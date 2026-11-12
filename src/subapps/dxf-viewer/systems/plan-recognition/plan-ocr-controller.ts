/**
 * ADR-929 Φ0.6 — η **τοπική ανάγνωση** (OCR στη συσκευή) μέσα στον ελεγκτή της αναγνώρισης. Υπο-module του ενός γραφέα
 * του `planRecognitionStore` (`planRecognitionSession.ocr`), όπως το `plan-scale-controller`.
 *
 * Κύκλος: η αναγνώριση γίνεται `ready` ⇒ `start(run)` **αυτόματα**, στο παρασκήνιο (τίποτα δεν φεύγει από τη συσκευή,
 * κόστος 0) → πρόοδος στο store → τα κείμενα μένουν εδώ, ανά αναγνώριση → η ανάγνωση για την **τρέχουσα** όψη μπαίνει
 * από την ΙΔΙΑ πόρτα με του VLM (`adoptReading`) → η νέα πηγή γραμμών πάει στον βοηθό από το ΙΔΙΟ κανάλι (`publish`).
 *
 * 🔑 **Ένα `reading`, κανείς δεύτερος δρόμος.** Η ανάγνωση AI έχει προτεραιότητα: αν υπάρχει όταν τελειώνει το OCR,
 *   τα κείμενα κρατιούνται αλλά **δεν** την αντικαθιστούν. Η συμφωνία δύο αναγνώσεων ανήκει στη σύντηξη (Δ20 Σ1).
 * 🔑 **Ακολουθεί την όψη**: σε αλλαγή όψης η ανάγνωση **ξαναπαράγεται** από τα ίδια κείμενα (`readingFor`), χωρίς Worker.
 * 🔑 Αγώνες: σειριακός αριθμός + ταυτότητα αναγνώρισης. Αποτέλεσμα για παλιό `run` ή ακυρωμένο **αγνοείται**.
 * ⚠️ Zero-copy: το `raster` μετακομίζει στον Worker ⇒ νέο buffer ανά κλήση (`provider.getRecognitionRaster`).
 * 🔑 ADR-929 §6.16 βήμα 4 — η εικόνα αναγνώρισης μπορεί να είναι **πυκνότερη** από τα `naturalBounds` (σάρωση PDF στην εγγενή
 *   της ανάλυση). Τα κείμενα γυρίζουν σε px των `naturalBounds` **μία φορά, στην παραλαβή** (`ocrTextsToNatural`)· από εκεί και
 *   πέρα όλα (όψη, ανάγνωση, σύντηξη) μένουν στον ίδιο χώρο με τα τμήματα και την ευθυγράμμιση.
 *
 * Zero React.
 *
 * @see ./plan-recognition-session.ts (ο ιδιοκτήτης)
 * @see ../../bim/plan-recognition/ocr/plan-ocr-client.ts (ο αναγνώστης, Worker)
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { RecognitionRaster } from '@/lib/geometry/raster/plan-raster';
import {
  WORKER_RPC_MESSAGE_ERROR, WORKER_RPC_UNREADY, type WorkerRpcCancellableResult,
} from '@/lib/workers/worker-rpc-protocol';
import type { PlanReadingOutcome } from '../../bim/plan-recognition/plan-recognition-types';
import type { OcrText } from '../../bim/plan-recognition/ocr/ocr-engine';
import { isOcrAssetFailure } from '../../bim/plan-recognition/ocr/ocr-asset-loader';
import {
  isLocalOcrOutcome, ocrTextsInView, ocrTextsToNatural, planReadingFromOcr,
} from '../../bim/plan-recognition/ocr/ocr-reading';
import type { PlanOcrReader } from '../../bim/plan-recognition/ocr/plan-ocr-client';
import type { PlanOcrProgress, PlanOcrReply } from '../../bim/plan-recognition/ocr/plan-ocr-host';
import {
  belongsToRecognition,
  planRecognitionStore,
  recognitionRootId,
  type PlanOcrFailure,
  type PlanOcrState,
  type PlanRecognitionRun,
} from './plan-recognition-store';

export interface PlanOcrControllerDeps<T> {
  readonly reader: () => Pick<PlanOcrReader, 'read'>;
  /** Νέο buffer της εικόνας **αναγνώρισης** ανά κλήση (`provider.getRecognitionRaster`), με την κλίμακά της προς τα `naturalBounds`. */
  readonly recognitionRaster: (floorId: string) => Promise<RecognitionRaster | null>;
  /** Η ταυτότητα της τοπικής ανάγνωσης από το μητρώο (`localOcrModelId(resolveOcrAssets())`) — μπορεί να πετάξει. */
  readonly model: () => string;
  /** Ο ιδιοκτήτης ξανατρέχει **μόνο** τη σύντηξη με την ανάγνωση και δίνει τη νέα πηγή γραμμών. */
  readonly adoptReading: (outcome: PlanReadingOutcome) => T | null;
  /** Παράδοση στον βοηθό: πηγή που δεν ζήτησε άμεσα ο wiring. */
  readonly publish: (source: T) => void;
}

/** Τα κείμενα μιας αναγνώρισης, με την ταυτότητα του μοντέλου που τα διάβασε. */
interface OcrTexts {
  readonly rootId: string;
  readonly model: string;
  readonly texts: readonly OcrText[];
}

/** Ο Worker δεν υπάρχει ή δεν ξεκίνησε ποτέ (χωρίς χειραψία / μήνυμα που δεν διαβάζεται — ADR-929 Φ0.6). */
const WORKER_DOWN: ReadonlySet<string> = new Set(['worker-unavailable', WORKER_RPC_UNREADY, WORKER_RPC_MESSAGE_ERROR]);

const failureOf = (error: string): PlanOcrFailure => {
  if (WORKER_DOWN.has(error)) return 'worker-unavailable';
  return isOcrAssetFailure(error) ? 'models-unavailable' : 'ocr-failed';
};

export function createPlanOcrController<T>(depsOf: () => PlanOcrControllerDeps<T>) {
  let sequence = 0;
  let abort: AbortController | null = null;
  let read: OcrTexts | null = null;

  const setOcr = (ocr: PlanOcrState): void => planRecognitionStore.patch({ ocr });
  const isRunning = (): boolean => planRecognitionStore.get().ocr.status === 'running';

  function stop(): void {
    sequence += 1;
    abort?.abort();
    abort = null;
  }

  /** Η ανάγνωση των κειμένων για την όψη **αυτού** του `run` (ή `null`: άλλη αναγνώριση, ή δεν διαβάστηκε). */
  function readingFor(run: PlanRecognitionRun): PlanReadingOutcome | null {
    if (!read || !belongsToRecognition(run.id, read.rootId)) return null;
    const texts = ocrTextsInView(read.texts, run.maskView, run.alignment.originalToAligned);
    return { status: 'read', reading: planReadingFromOcr({ texts, toOriginal: IDENTITY_HOMOGRAPHY, model: read.model }) };
  }

  /** Τα κείμενα ⇒ ανάγνωση στη σύντηξη — εκτός αν ήδη μετρά ανάγνωση AI (προτεραιότητα, Δ5). */
  function adopt(texts: OcrTexts): void {
    read = texts;
    setOcr({ status: 'done' });
    const { run, reading } = planRecognitionStore.get();
    if (!run || (reading !== null && !isLocalOcrOutcome(reading))) return;
    const outcome = readingFor(run);
    const source = outcome ? depsOf().adoptReading(outcome) : null;
    if (source) depsOf().publish(source);
  }

  function settle(
    rootId: string, model: string, naturalPerRasterPx: number, reply: WorkerRpcCancellableResult<PlanOcrReply>,
  ): void {
    if (reply.kind === 'superseded') return; // μια νεότερη ανάγνωση κατέχει την κατάσταση
    if (reply.kind === 'cancelled') setOcr({ status: 'cancelled' });
    else if (reply.kind === 'failed') setOcr({ status: 'failed', reason: failureOf(reply.error) });
    else adopt({ rootId, model, texts: ocrTextsToNatural(reply.value.texts, naturalPerRasterPx) });
  }

  /** Η εικόνα αναγνώρισης· μια απόρριψη του provider μετρά ως «χωρίς pixel», όχι ως εξαίρεση. */
  const recognitionRasterOf = (floorId: string): Promise<RecognitionRaster | null> =>
    depsOf().recognitionRaster(floorId).catch(() => null);

  function onProgress(seq: number): (progress: PlanOcrProgress) => void {
    return ({ stage, done, total }) => {
      if (seq === sequence) setOcr({ status: 'running', stage, done, total });
    };
  }

  async function start(run: PlanRecognitionRun): Promise<void> {
    stop();
    read = null;
    let model: string;
    try {
      model = depsOf().model();
    } catch {
      setOcr({ status: 'failed', reason: 'models-unavailable' });
      return;
    }
    const rootId = recognitionRootId(run.id);
    const seq = sequence;
    setOcr({ status: 'running', stage: null, done: 0, total: 0 });
    const source = await recognitionRasterOf(run.floorId); // απόδοση PDF στην εγγενή ανάλυση: δευτερόλεπτα
    if (seq !== sequence) return; // ακύρωση / νεότερη ανάγνωση στο μεταξύ
    if (!source) {
      setOcr({ status: 'failed', reason: 'no-pixels' });
      return;
    }
    const { raster, naturalPerRasterPx } = source;
    const controller = new AbortController();
    abort = controller;
    const reply = await depsOf().reader()
      .read(raster, { signal: controller.signal, onProgress: onProgress(seq) })
      .catch((): WorkerRpcCancellableResult<PlanOcrReply> => ({ kind: 'failed', error: 'ocr-failed' }));
    if (seq !== sequence) return;
    abort = null;
    const current = planRecognitionStore.get().run;
    if (current && belongsToRecognition(current.id, rootId)) settle(rootId, model, naturalPerRasterPx, reply);
  }

  return {
    /** Νέα αναγνώριση ⇒ νέα τοπική ανάγνωση· ό,τι έτρεχε για την παλιά ακυρώνεται. */
    start,

    /** Η ανάγνωση για την όψη ενός νέου `run` της ίδιας αναγνώρισης (οι τοίχοι ακολουθούν την όψη, §6.10 Α2). */
    readingFor,

    /** «Ακύρωση» από τον άνθρωπο: ο Worker σταματά πριν από την επόμενη κλήση μοντέλου. */
    cancel(): void {
      if (!isRunning()) return;
      stop();
      setOcr({ status: 'cancelled' });
    },

    /** «Ξανά» μετά από ακύρωση ή αποτυχία, για την τρέχουσα αναγνώριση. */
    retry(): void {
      const { run, ocr } = planRecognitionStore.get();
      if (run && (ocr.status === 'cancelled' || ocr.status === 'failed')) void start(run);
    },

    /** Κλείσιμο / αποτυχία της αναγνώρισης: ακύρωση, τα κείμενα ξεχνιούνται. Το store το καθαρίζει ο ιδιοκτήτης. */
    reset(): void {
      stop();
      read = null;
    },
  };
}
