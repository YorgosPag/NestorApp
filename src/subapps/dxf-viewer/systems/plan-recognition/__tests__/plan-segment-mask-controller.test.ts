/**
 * @jest-environment node
 *
 * ⚓ ADR-929 §6.10 Α2 — οι τοίχοι ακολουθούν την όψη: ιδεμποτία, πρόταση χωρίς Worker, αγώνες (σειριακός αριθμός +
 * ταυτότητα αναγνώρισης), αποτυχία με όνομα, σβήσιμο της ανάγνωσης AI με αναίρεση ενός επιπέδου.
 * Ψεύτικα: Worker (με αναβαλλόμενες απαντήσεις), σύντηξη, πηγή γραμμών. Πραγματικά: store, ελεγκτής, κλειδί όψης.
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { WorkerRpcResult } from '@/lib/workers/worker-rpc-protocol';
import type { PlanSegmentsRequest } from '../../../bim/plan-recognition/alignment/plan-align-client';
import type { PlanSegmentsReply } from '../../../bim/plan-recognition/alignment/plan-align-host';
import type { PlanAlignment } from '../../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanFusionResult } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome, RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import type { PlanReadingView } from '../../../bim/plan-recognition/reading/plan-reading-view';
import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import {
  WALLS_FOLLOWING,
  planRecognitionStore,
  type PlanReadingReview,
  type PlanRecognitionRun,
} from '../plan-recognition-store';
import { createPlanSegmentMaskController, type PlanSegmentMaskDeps } from '../plan-segment-mask-controller';

const SIZE = 200;
const INK = new Uint8Array(SIZE * SIZE);
const ALIGNMENT = {
  image: { width: SIZE, height: SIZE, rgba: new Uint8ClampedArray(0) },
  ink: INK,
  sheet: null,
  alignedToOriginal: IDENTITY_HOMOGRAPHY,
  originalToAligned: IDENTITY_HOMOGRAPHY,
  workingScale: 1,
} as unknown as PlanAlignment;

const seg = (id: string): RasterSegment => ({ id, start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, style: 'stroke' }) as unknown as RasterSegment;
const ORIGINAL = [seg('ps0'), seg('ps1'), seg('ps2')];
const SCALE_AT_RECOGNITION: RasterPixelScale = { metresPerPixelX: 0.01, metresPerPixelY: 0.01, source: 'gallery-scale' };
const SCALE_LATER: RasterPixelScale = { metresPerPixelX: 0.02, metresPerPixelY: 0.02, source: 'calibration' } as RasterPixelScale;

const PROPOSED: PlanReadingView = { crop: { minX: 0, minY: 0, maxX: SIZE, maxY: SIZE }, redacted: [] };
const CROPPED: PlanReadingView = { crop: { minX: 0, minY: 0, maxX: 120, maxY: SIZE }, redacted: [] };
const HIDDEN: PlanReadingView = { crop: PROPOSED.crop, redacted: [{ minX: 150, minY: 150, maxX: 200, maxY: 200 }] };
/** Ανάγνωση AI (το `model` δεν έχει το πρόθεμα του τοπικού OCR ⇒ δεμένη στην όψη, `isLocalOcrOutcome`). */
const READING = { status: 'read', reading: { tag: 'ai', model: 'vlm-test' } } as unknown as PlanReadingOutcome;
const READ_SEND = { status: 'read', counts: { texts: 3, dimensions: 1, rooms: 0, openings: 0 }, cacheHit: false } as const;

function recognition(): PlanRecognitionRun {
  return {
    id: 'rec1', floorId: 'flr', backgroundId: 'bg', kind: 'scan', alignment: ALIGNMENT, segments: ORIGINAL,
    segmentRoles: [], knownScale: SCALE_AT_RECOGNITION,
  };
}

function reviewOf(view: PlanReadingView, send: PlanReadingReview['send'] = { status: 'idle' }): PlanReadingReview {
  return { proposed: PROPOSED, view, tool: 'select', packet: null, preflight: { status: 'idle' }, send, walls: WALLS_FOLLOWING };
}

interface Pending {
  readonly request: PlanSegmentsRequest;
  readonly resolve: (r: WorkerRpcResult<PlanSegmentsReply>) => void;
}

function okReply(ids: readonly string[]): WorkerRpcResult<PlanSegmentsReply> {
  return {
    kind: 'ok',
    value: {
      extraction: {
        segments: ids.map(seg), strokeWidthPx: 2, minLengthPx: 8, obliqueAnglesDeg: [],
        classification: { verdicts: [], textHeightPx: null, glyphCount: 0 },
      },
    },
  };
}

function harness() {
  const calls: Pending[] = [];
  const published: string[] = [];
  const fused: Array<{ runId: string; reading: PlanReadingOutcome | null; scale: RasterPixelScale | null }> = [];
  let version = 0;
  const deps: PlanSegmentMaskDeps<string> = {
    extractor: () => ({
      extractSegments: (request) => new Promise((resolve) => { calls.push({ request, resolve }); }),
    }),
    fuse: (run, reading) => {
      fused.push({ runId: run.id, reading, scale: run.knownScale });
      return { tag: `${run.id}:${reading ? 'read' : 'geo'}` } as unknown as PlanFusionResult;
    },
    lineSource: (run) => `${run.id}#${(version += 1)}`,
    publish: (source) => { published.push(source); },
  };
  const controller = createPlanSegmentMaskController(() => deps);
  return { controller, calls, published, fused };
}

const state = () => planRecognitionStore.get();
const flush = () => new Promise<void>((r) => { setTimeout(r, 0); });

/** Η αλλαγή όπως τη δεσμεύει ο έλεγχος της όψης: πρώτα η όψη στο store, μετά η ειδοποίηση με την όψη ΠΡΙΝ. */
function commit(controller: ReturnType<typeof harness>['controller'], view: PlanReadingView): Promise<void> {
  const before = state().review!;
  planRecognitionStore.patch({ review: { ...before, view, send: { status: 'idle' } } });
  return controller.apply(view, before);
}

beforeEach(() => {
  planRecognitionStore.reset();
  planRecognitionStore.patch({ phase: 'ready', run: recognition(), fusion: {} as PlanFusionResult, review: reviewOf(PROPOSED) });
});

describe('ADR-929 §6.10 Α2 — οι τοίχοι ακολουθούν την όψη', () => {
  it('ιδεμποτία: ίδια όψη με εκείνη των τοίχων ⇒ κανένας Worker, καμία νέα πηγή', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    await commit(h.controller, PROPOSED);
    expect(h.calls).toHaveLength(0);
    expect(h.published).toHaveLength(0);
    expect(state().run?.id).toBe('rec1');
  });

  it('crop: ο Worker με το μελάνι του store, τη μάσκα της όψης και την κλίμακα της ΑΝΑΓΝΩΡΙΣΗΣ ⇒ νέο run + πηγή', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ run: { ...recognition(), knownScale: SCALE_LATER } }); // βαθμονόμηση στο μεταξύ
    const pending = commit(h.controller, CROPPED);
    expect(state().review?.walls).toEqual({ status: 'updating', readingDropped: false });
    expect(h.calls).toHaveLength(1);
    const { request } = h.calls[0];
    expect(request.source.ink).toBe(INK); // το αντίγραφο το κάνει ο πελάτης του Worker
    expect(request.source.image).toEqual({ width: SIZE, height: SIZE });
    expect(request.mask).toEqual({ region: CROPPED.crop, excluded: [] });
    expect(request.request).toEqual({ scale: SCALE_AT_RECOGNITION });
    h.calls[0].resolve(okReply(['ps0']));
    await pending;
    expect(state().run).toMatchObject({ id: 'rec1.m1', maskView: CROPPED, knownScale: SCALE_LATER, segments: [seg('ps0')] });
    expect(state().fusion).toEqual({ tag: 'rec1.m1:geo' });
    expect(state().review?.walls).toEqual(WALLS_FOLLOWING);
    expect(h.published).toEqual(['rec1.m1#1']);
  });

  it('η επιστροφή στην πρόταση ⇒ η ΑΡΧΙΚΗ εξαγωγή, από μνήμη, χωρίς Worker', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const first = commit(h.controller, HIDDEN);
    h.calls[0].resolve(okReply(['ps9']));
    await first;
    await commit(h.controller, PROPOSED);
    expect(h.calls).toHaveLength(1);
    expect(state().run).toMatchObject({ id: 'rec1.m2', segments: ORIGINAL, maskView: undefined });
    expect(h.published).toEqual(['rec1.m1#1', 'rec1.m2#2']);
  });

  it('αγώνας: δύο αλλαγές, η ΠΑΛΙΑ απάντηση φτάνει τελευταία ⇒ αγνοείται', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const a = commit(h.controller, CROPPED);
    const b = commit(h.controller, HIDDEN);
    h.calls[1].resolve(okReply(['b']));
    await b;
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(state().run).toMatchObject({ maskView: HIDDEN, segments: [seg('b')] });
    expect(h.published).toHaveLength(1);
  });

  it('αγώνας: αλλαγή πίσω στην όψη των τοίχων ενώ τρέχει η επόμενη ⇒ η επόμενη ακυρώνεται, «ακολουθούν»', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const a = commit(h.controller, CROPPED);
    await commit(h.controller, PROPOSED);
    expect(state().review?.walls.status).toBe('following');
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(state().run?.id).toBe('rec1');
    expect(h.published).toHaveLength(0);
  });

  it('νέα αναγνώριση (ή κλείσιμο) στη μέση ⇒ η απάντηση δεν αγγίζει τίποτα', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const a = commit(h.controller, CROPPED);
    planRecognitionStore.patch({ run: { ...recognition(), id: 'rec2' } });
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(state().run?.id).toBe('rec2');
    const b = commit(h.controller, HIDDEN);
    h.controller.track(null, null);
    expect(h.calls).toHaveLength(1); // rec2 δεν είναι της αναγνώρισης που παρακολουθείται ⇒ ούτε καν ερώτηση
    await b;
    expect(h.published).toHaveLength(0);
  });

  it('ακύρωση (η όψη έκλεισε) στη μέση ⇒ η απάντηση αγνοείται', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const a = commit(h.controller, CROPPED);
    h.controller.cancel();
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(state().run?.id).toBe('rec1');
    expect(h.published).toHaveLength(0);
  });

  it('αποτυχία του Worker ⇒ «απέτυχαν» με όνομα· οι τοίχοι και η ανάγνωση μένουν ως είχαν', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING });
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve({ kind: 'failed', error: 'boom' });
    await a;
    expect(state().review?.walls).toEqual({ status: 'failed', readingDropped: false });
    expect(state().run?.id).toBe('rec1');
    expect(state().reading).toBe(READING);
    expect(h.published).toHaveLength(0);
  });

  it('με ανάγνωση AI: σβήνεται, και η Αναίρεση φέρνει πίσω run + ανάγνωση + την όψη ΠΡΙΝ την ΠΡΩΤΗ αλλαγή', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING, review: reviewOf(PROPOSED, READ_SEND) });
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve(okReply(['a']));
    await a;
    const b = commit(h.controller, HIDDEN); // δεύτερη αλλαγή: η αναίρεση μένει της πρώτης
    h.calls[1].resolve(okReply(['b']));
    await b;
    expect(state().reading).toBeNull();
    expect(state().review?.walls).toEqual({ status: 'following', readingDropped: true });
    planRecognitionStore.patch({ run: { ...state().run!, knownScale: SCALE_LATER } });
    expect(h.controller.undo()).toEqual({ view: PROPOSED, send: READ_SEND });
    expect(state().run).toMatchObject({ id: 'rec1', segments: ORIGINAL, knownScale: SCALE_LATER });
    expect(state().reading).toBe(READING);
    expect(h.fused.at(-1)).toEqual({ runId: 'rec1', reading: READING, scale: SCALE_LATER }); // σύντηξη με τη ΣΗΜΕΡΙΝΗ κλίμακα
    expect(h.published.at(-1)).toBe('rec1#3');
    expect(h.controller.undo()).toBeNull(); // ένα επίπεδο
  });

  it('δύο αλλαγές σε πτήση ΕΝΩ ζει η ανάγνωση: η αναίρεση γυρίζει στην όψη πριν την ΠΡΩΤΗ, όχι στην ενδιάμεση', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING, review: reviewOf(PROPOSED, READ_SEND) });
    const a = commit(h.controller, CROPPED);
    const b = commit(h.controller, HIDDEN); // η ανάγνωση ζει ακόμη: η «πριν» εδώ είναι η CROPPED
    h.calls[1].resolve(okReply(['b']));
    await b;
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(h.controller.undo()).toEqual({ view: PROPOSED, send: READ_SEND });
  });

  it('η αναίρεση ακυρώνει ό,τι τρέχει για τους τοίχους', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING });
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve(okReply(['a']));
    await a;
    const b = commit(h.controller, HIDDEN);
    h.controller.undo();
    h.calls[1].resolve(okReply(['b']));
    await b;
    expect(state().run?.id).toBe('rec1');
    expect(state().reading).toBe(READING);
  });

  it('χωρίς ανάγνωση: τίποτα να αναιρεθεί', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve(okReply(['a']));
    await a;
    expect(state().review?.walls.readingDropped).toBe(false);
    expect(h.controller.undo()).toBeNull();
  });

  it('νέα ανάγνωση μετά το σβήσιμο ⇒ η αναίρεση της παλιάς χάνεται', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING });
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve(okReply(['a']));
    await a;
    h.controller.forgetReadingUndo();
    expect(state().review?.walls.readingDropped).toBe(false);
    expect(h.controller.undo()).toBeNull();
  });

  it('αλλαγή που απέτυχε και μετά επιστροφή: η ανάγνωση δεν σβήνεται ποτέ, καμία αναίρεση', async () => {
    const h = harness();
    h.controller.track(recognition(), SCALE_AT_RECOGNITION);
    planRecognitionStore.patch({ reading: READING });
    const a = commit(h.controller, CROPPED);
    h.calls[0].resolve({ kind: 'failed', error: 'boom' });
    await a;
    await commit(h.controller, PROPOSED);
    await flush();
    expect(state().reading).toBe(READING);
    expect(state().review?.walls).toEqual(WALLS_FOLLOWING);
    expect(h.controller.undo()).toBeNull();
  });
});
