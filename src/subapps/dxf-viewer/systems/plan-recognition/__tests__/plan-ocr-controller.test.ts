/**
 * @jest-environment node
 *
 * ⚓ ADR-929 Φ0.6 — η τοπική ανάγνωση (OCR στη συσκευή) μέσα στον ελεγκτή της αναγνώρισης:
 *   · ροή: πρόοδος στο store → κείμενα → ανάγνωση από την ΙΔΙΑ πόρτα (`adoptReading`) → πηγή στο ΙΔΙΟ κανάλι (`publish`)·
 *   · προτεραιότητα AI: το OCR **ποτέ** δεν αντικαθιστά ανάγνωση AI — κρατά μόνο τα κείμενα·
 *   · ακολουθεί την όψη (`readingFor`), μόνο για την ΙΔΙΑ αναγνώριση·
 *   · ακύρωση · αγώνες (σειριακός αριθμός + ταυτότητα αναγνώρισης) · «Ξανά» σε `run` όψης · κάθε λόγος αποτυχίας.
 * Ψεύτικα: αναγνώστης (Worker, με αναβαλλόμενες απαντήσεις), μητρώο, εικόνα, σύντηξη. Πραγματικά: store, ελεγκτής,
 * μετατροπή κειμένων → ανάγνωση, κανόνας όψης, συντελεστής μείωσης.
 */

import { IDENTITY_HOMOGRAPHY, type Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { WorkerRpcCancellableResult } from '@/lib/workers/worker-rpc-protocol';
import type { PlanAlignment } from '../../../bim/plan-recognition/alignment/plan-alignment-types';
import type { OcrText } from '../../../bim/plan-recognition/ocr/ocr-engine';
import type { PlanOcrReadOptions } from '../../../bim/plan-recognition/ocr/plan-ocr-client';
import type { PlanOcrReply } from '../../../bim/plan-recognition/ocr/plan-ocr-host';
import type { PlanReadingOutcome } from '../../../bim/plan-recognition/plan-recognition-types';
import type { PlanReadingView } from '../../../bim/plan-recognition/reading/plan-reading-view';
import { createPlanOcrController, type PlanOcrControllerDeps } from '../plan-ocr-controller';
import { planRecognitionStore, type PlanRecognitionRun } from '../plan-recognition-store';

const MODEL = 'local-ocr:det@1+rec@1+rec2@1';
const ALIGNMENT = {
  image: { width: 1000, height: 1000, rgba: new Uint8ClampedArray(0) },
  sheet: null,
  alignedToOriginal: IDENTITY_HOMOGRAPHY,
  originalToAligned: IDENTITY_HOMOGRAPHY,
  workingScale: 1,
} as unknown as PlanAlignment;

/** 5000×5000 = 25 Mpx > 16 Mpx ⇒ συντελεστής 2. Τα pixel δεν διαβάζονται (ψεύτικος αναγνώστης). */
const RASTER: PlanRaster = { width: 5000, height: 5000, rgba: new Uint8ClampedArray(0) };

const quad = (x: number, y: number, w: number, h: number): Quad =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const ocr = (text: string, polygon: Quad): OcrText => ({ text, recScore: 0.9, detScore: 0.8, rotation: 0, polygon, reader: 'primary' });

/** «3.50» αριστερά (κέντρο 120,105), «2.85» δεξιά (κέντρο 820,105). */
const TEXTS: readonly OcrText[] = [ocr('3.50', quad(100, 100, 40, 10)), ocr('2.85', quad(800, 100, 40, 10))];
const LEFT_HALF: PlanReadingView = { crop: { minX: 0, minY: 0, maxX: 500, maxY: 1000 }, redacted: [] };
const AI_READING = { status: 'read', reading: { model: 'vlm-test', texts: [], dimensions: [] } } as unknown as PlanReadingOutcome;

function run(id: string, maskView?: PlanReadingView): PlanRecognitionRun {
  return { id, floorId: 'flr', backgroundId: 'bg', kind: 'scan', alignment: ALIGNMENT, segments: [], knownScale: null, maskView };
}

interface Pending {
  readonly options: PlanOcrReadOptions;
  readonly resolve: (reply: WorkerRpcCancellableResult<PlanOcrReply>) => void;
  readonly reject: (error: Error) => void;
}

function harness(overrides: Partial<PlanOcrControllerDeps<string>> = {}) {
  const calls: Pending[] = [];
  const adopted: PlanReadingOutcome[] = [];
  const published: string[] = [];
  const deps: PlanOcrControllerDeps<string> = {
    reader: () => ({
      read: (_raster, options) => new Promise((resolve, reject) => { calls.push({ options, resolve, reject }); }),
    }),
    raster: () => RASTER,
    model: () => MODEL,
    adoptReading: (outcome) => {
      adopted.push(outcome);
      return `src#${adopted.length}`;
    },
    publish: (source) => { published.push(source); },
    ...overrides,
  };
  const controller = createPlanOcrController(() => deps);
  return { controller, calls, adopted, published };
}

const state = () => planRecognitionStore.get();
const flush = () => new Promise<void>((r) => { setTimeout(r, 0); });
const ok = (texts: readonly OcrText[] = TEXTS): WorkerRpcCancellableResult<PlanOcrReply> => ({ kind: 'ok', value: { texts } });
const rawsOf = (outcome: PlanReadingOutcome | null): string[] =>
  outcome?.status === 'read' ? outcome.reading.texts.map((t) => t.raw) : [];

/** Ξεκινά την ανάγνωση για το τρέχον `run` και επιστρέφει την υπόσχεσή της (η απάντηση δίνεται από το test). */
function startOn(h: ReturnType<typeof harness>, r: PlanRecognitionRun): Promise<void> {
  planRecognitionStore.patch({ phase: 'ready', run: r });
  return h.controller.start(r);
}

beforeEach(() => {
  planRecognitionStore.reset();
});

describe('ADR-929 Φ0.6 — ροή: πρόοδος → κείμενα → ΜΙΑ ανάγνωση από την ίδια πόρτα', () => {
  it('running με πρόοδο, συντελεστής μείωσης από τον προϋπολογισμό, μετά done + adoptReading + publish', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    expect(state().ocr).toEqual({ status: 'running', stage: null, done: 0, total: 0 });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].options.downscale).toBe(2);

    h.calls[0].options.onProgress?.({ stage: 'detect', done: 3, total: 8 });
    expect(state().ocr).toEqual({ status: 'running', stage: 'detect', done: 3, total: 8 });

    h.calls[0].resolve(ok());
    await done;
    expect(state().ocr).toEqual({ status: 'done' });
    expect(h.adopted).toHaveLength(1);
    const reading = h.adopted[0].status === 'read' ? h.adopted[0].reading : null;
    expect(reading?.model).toBe(MODEL);
    expect(reading?.dimensions.map((d) => d.valueMm)).toEqual([3500, 2850]);
    expect(h.published).toEqual(['src#1']);
  });

  it('η πόρτα δεν δίνει πηγή ⇒ τίποτα στο κανάλι', async () => {
    const h = harness({ adoptReading: () => null });
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve(ok());
    await done;
    expect(state().ocr.status).toBe('done');
    expect(h.published).toEqual([]);
  });

  it('απάντηση `superseded` ⇒ η κατάσταση δεν αγγίζεται (την κατέχει νεότερη ανάγνωση)', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve({ kind: 'superseded' });
    await done;
    expect(state().ocr.status).toBe('running');
    expect(h.adopted).toEqual([]);
  });
});

describe('προτεραιότητα AI — ένα `reading`, το OCR δεν αντικαθιστά ποτέ ανάγνωση AI', () => {
  it('μετρά ήδη ανάγνωση AI ⇒ done, καμία υιοθέτηση, αλλά τα κείμενα κρατιούνται για την όψη', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    planRecognitionStore.patch({ reading: AI_READING });
    h.calls[0].resolve(ok());
    await done;
    expect(state().ocr.status).toBe('done');
    expect(state().reading).toBe(AI_READING);
    expect(h.adopted).toEqual([]);
    expect(h.published).toEqual([]);
    expect(rawsOf(h.controller.readingFor(run('rec1')))).toEqual(['3.50', '2.85']);
  });

  it('η τρέχουσα ανάγνωση είναι ήδη τοπική ⇒ αντικαθίσταται (νέα κείμενα, ίδια πόρτα)', async () => {
    const h = harness();
    const first = startOn(h, run('rec1'));
    h.calls[0].resolve(ok());
    await first;
    planRecognitionStore.patch({ reading: h.adopted[0], ocr: { status: 'failed', reason: 'ocr-failed' } });
    h.controller.retry();
    h.calls[1].resolve(ok([TEXTS[0]]));
    await flush();
    expect(h.adopted).toHaveLength(2);
    expect(rawsOf(h.adopted[1])).toEqual(['3.50']);
  });
});

describe('ακολουθεί την όψη — η ανάγνωση ξαναπαράγεται από τα ίδια κείμενα, χωρίς Worker', () => {
  it('όψη με crop ⇒ μόνο τα κείμενα με κέντρο μέσα· άλλη αναγνώριση ⇒ null', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve(ok());
    await done;
    expect(rawsOf(h.controller.readingFor(run('rec1.m2', LEFT_HALF)))).toEqual(['3.50']);
    expect(rawsOf(h.controller.readingFor(run('rec1.m3')))).toEqual(['3.50', '2.85']);
    expect(h.controller.readingFor(run('rec2'))).toBeNull();
    expect(h.controller.readingFor(run('rec10'))).toBeNull(); // ίδιο πρόθεμα χαρακτήρων ≠ ίδια αναγνώριση
    expect(h.calls).toHaveLength(1);
  });

  it('πριν διαβαστεί τίποτα ⇒ null', () => {
    expect(harness().controller.readingFor(run('rec1'))).toBeNull();
  });
});

describe('ακύρωση και αγώνες', () => {
  it('«Ακύρωση» ⇒ cancelled + abort· η μεταγενέστερη απάντηση και η πρόοδός της αγνοούνται', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.controller.cancel();
    expect(state().ocr).toEqual({ status: 'cancelled' });
    expect(h.calls[0].options.signal?.aborted).toBe(true);
    h.calls[0].options.onProgress?.({ stage: 'read', done: 1, total: 2 });
    h.calls[0].resolve(ok());
    await done;
    expect(state().ocr).toEqual({ status: 'cancelled' });
    expect(h.adopted).toEqual([]);
  });

  it('«Ακύρωση» όταν δεν τρέχει τίποτα ⇒ καμία αλλαγή', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve(ok());
    await done;
    h.controller.cancel();
    expect(state().ocr).toEqual({ status: 'done' });
  });

  it('νέα αναγνώριση ⇒ η παλιά ακυρώνεται και η απάντησή της αγνοείται', async () => {
    const h = harness();
    const first = startOn(h, run('rec1'));
    const second = startOn(h, run('rec2'));
    expect(h.calls[0].options.signal?.aborted).toBe(true);
    h.calls[0].resolve(ok());
    await first;
    expect(h.adopted).toEqual([]);
    expect(state().ocr.status).toBe('running');
    h.calls[1].resolve(ok([TEXTS[1]]));
    await second;
    expect(rawsOf(h.adopted[0])).toEqual(['2.85']);
    expect(h.controller.readingFor(run('rec1'))).toBeNull();
  });

  it('το store έχει πια άλλη αναγνώριση (χωρίς νέο start) ⇒ η απάντηση αγνοείται', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    planRecognitionStore.patch({ run: run('rec2') });
    h.calls[0].resolve(ok());
    await done;
    expect(h.adopted).toEqual([]);
  });

  it('η αναγνώριση πέρασε σε όψη της (rec1 → rec1.m2) ⇒ η απάντηση μετρά, με την όψη της', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    planRecognitionStore.patch({ run: run('rec1.m2', LEFT_HALF) });
    h.calls[0].resolve(ok());
    await done;
    expect(rawsOf(h.adopted[0])).toEqual(['3.50']);
  });

  it('reset ⇒ abort, τα κείμενα ξεχνιούνται', async () => {
    const h = harness();
    const first = startOn(h, run('rec1'));
    h.calls[0].resolve(ok());
    await first;
    const second = h.controller.start(run('rec1'));
    h.controller.reset();
    expect(h.calls[1].options.signal?.aborted).toBe(true);
    expect(h.controller.readingFor(run('rec1'))).toBeNull();
    h.calls[1].resolve(ok());
    await second;
    expect(h.adopted).toHaveLength(1);
  });
});

describe('«Ξανά»', () => {
  it('σε run όψης (rec1.m2) μετά από αποτυχία ⇒ νέα ανάγνωση της ίδιας αναγνώρισης, με την όψη', async () => {
    const h = harness();
    planRecognitionStore.patch({ phase: 'ready', run: run('rec1.m2', LEFT_HALF), ocr: { status: 'failed', reason: 'ocr-failed' } });
    h.controller.retry();
    expect(state().ocr.status).toBe('running');
    h.calls[0].resolve(ok());
    await flush();
    expect(state().ocr.status).toBe('done');
    expect(rawsOf(h.adopted[0])).toEqual(['3.50']);
  });

  it('μετά από ακύρωση ⇒ ξεκινά· όταν τρέχει ή τελείωσε ⇒ τίποτα', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.controller.retry();
    expect(h.calls).toHaveLength(1);
    h.controller.cancel();
    h.calls[0].resolve({ kind: 'cancelled' });
    await done;
    h.controller.retry();
    expect(h.calls).toHaveLength(2);
    h.calls[1].resolve(ok());
    await flush();
    expect(state().ocr.status).toBe('done');
    h.controller.retry();
    expect(h.calls).toHaveLength(2);
  });

  it('χωρίς αναγνώριση ⇒ τίποτα', () => {
    const h = harness();
    planRecognitionStore.patch({ ocr: { status: 'cancelled' } });
    h.controller.retry();
    expect(h.calls).toHaveLength(0);
  });
});

describe('κάθε αποτυχία με όνομα', () => {
  it('το μητρώο πετά ⇒ models-unavailable, κανένας Worker', async () => {
    const h = harness({ model: () => { throw new Error('ocr-asset/missing'); } });
    await startOn(h, run('rec1'));
    expect(state().ocr).toEqual({ status: 'failed', reason: 'models-unavailable' });
    expect(h.calls).toHaveLength(0);
  });

  it('χωρίς pixel ⇒ no-pixels, κανένας Worker', async () => {
    const h = harness({ raster: () => null });
    await startOn(h, run('rec1'));
    expect(state().ocr).toEqual({ status: 'failed', reason: 'no-pixels' });
    expect(h.calls).toHaveLength(0);
  });

  it.each([
    ['worker-unavailable', 'worker-unavailable'],
    ['ocr-asset/integrity', 'models-unavailable'],
    ['boom', 'ocr-failed'],
  ] as const)('Worker: «%s» ⇒ %s', async (error, reason) => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve({ kind: 'failed', error });
    await done;
    expect(state().ocr).toEqual({ status: 'failed', reason });
    expect(h.adopted).toEqual([]);
  });

  it('ο αναγνώστης απορρίπτει ⇒ ocr-failed', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].reject(new Error('crash'));
    await done;
    expect(state().ocr).toEqual({ status: 'failed', reason: 'ocr-failed' });
  });

  it('απάντηση `cancelled` από τον Worker ⇒ cancelled', async () => {
    const h = harness();
    const done = startOn(h, run('rec1'));
    h.calls[0].resolve({ kind: 'cancelled' });
    await done;
    expect(state().ocr).toEqual({ status: 'cancelled' });
  });
});
