/**
 * @jest-environment node
 *
 * ⚓ ADR-929 Φ5.3β — ο έλεγχος της όψης πριν φύγει: «ό,τι βλέπεις, αυτό φεύγει» ως **δομή**, απόδειξη παραλαβής, αγώνες.
 * Ψεύτικα: Worker (απόδοση όψης), δίκτυο, pixel, URL. Πραγματικά: store, ελεγκτής, `viewSegmentsOf`, `readingViewSize`,
 * `planReadingFromView`.
 */

import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import type { PlanAlignment } from '../../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanReadingOutcome, RasterSegment } from '../../../bim/plan-recognition/plan-recognition-types';
import type {
  PlanReadingPreflightResult,
  PlanReadingRequest,
  PlanReadingRouteResult,
} from '../../../bim/plan-recognition/reading/plan-reading-contract';
import { addRedaction } from '../../../bim/plan-recognition/reading/plan-reading-view-edit';
import type { PlanViewReading } from '../../../bim/plan-recognition/reading/plan-reading-wire';
import type { PlanReadingView } from '../../../bim/plan-recognition/reading/plan-reading-view';
import { createPlanReadingReview, type PlanReadingReviewDeps } from '../plan-reading-review';
import { planRecognitionStore, type PlanRecognitionRun } from '../plan-recognition-store';
import type { PlanReadingRestore } from '../plan-segment-mask-controller';

const SIZE = 200;

const ALIGNMENT = {
  image: { width: SIZE, height: SIZE, rgba: new Uint8ClampedArray(0) },
  sheet: null,
  alignedToOriginal: IDENTITY_HOMOGRAPHY,
  originalToAligned: IDENTITY_HOMOGRAPHY,
  workingScale: 1,
} as unknown as PlanAlignment;

const SEGMENTS: RasterSegment[] = [
  { id: 's1', start: { x: 20, y: 20 }, end: { x: 180, y: 20 }, style: 'stroke' },
  { id: 's2', start: { x: 20, y: 150 }, end: { x: 60, y: 150 }, style: 'stroke' },
] as unknown as RasterSegment[];

function run(id = 'rec1'): PlanRecognitionRun {
  return { id, floorId: 'flr', backgroundId: 'bg', kind: 'scan', alignment: ALIGNMENT, segments: SEGMENTS, knownScale: null };
}

const EMPTY_READING: PlanViewReading = { texts: [], dimensions: [], rooms: [], openings: [], writtenScale: null };
const ALLOWED: PlanReadingPreflightResult = { status: 'allowed', model: 'm', estimateUsd: 0.04, remainingUsd: 9.5, monthlyCapUsd: 10 };

const NOTHING_DROPPED = { unknownSegmentRefs: 0, unknownTextRefs: 0, openingsWithoutHost: 0 };

/** Η απάντηση του διακομιστή για μια επιτυχή ανάγνωση, με την απόδειξη παραλαβής που δίνεται. */
const readAnswer = (imageSha256: string): PlanReadingRouteResult => ({
  status: 'read', readingId: 'r1', model: 'm', schemaVersion: 1, reading: EMPTY_READING,
  dropped: NOTHING_DROPPED, cacheHit: false, imageSha256,
});

interface Harness {
  readonly deps: PlanReadingReviewDeps<string>;
  readonly sent: Array<{ image: Blob; request: PlanReadingRequest }>;
  readonly adopted: PlanReadingOutcome[];
  readonly revoked: string[];
  /** ADR-929 §6.10 Α2 — οι δεσμευμένες όψεις που πήγαν στους τοίχους, με την όψη **πριν** την αλλαγή. */
  readonly committed: Array<{ view: PlanReadingView; before: PlanReadingView }>;
  readonly resets: { count: number };
  /** Ό,τι απαντά ο ψεύτικος διακομιστής· προεπιλογή: διάβασε, με το sha256 των bytes που **έλαβε**. */
  answer: (receivedSha: string) => PlanReadingRouteResult;
  /** Ό,τι δίνει η αναίρεση των τοίχων· προεπιλογή: τίποτα να αναιρεθεί. */
  restore: PlanReadingRestore | null;
}

function harness(): Harness {
  let urls = 0;
  const sent: Harness['sent'] = [];
  const adopted: PlanReadingOutcome[] = [];
  const revoked: string[] = [];
  const committed: Harness['committed'] = [];
  const resets = { count: 0 };
  const h: Harness = {
    sent, adopted, revoked, committed, resets,
    answer: readAnswer,
    restore: null,
    deps: {
      renderer: () => ({
        renderView: async (req) => ({
          kind: 'ok', value: { blob: new Blob([`png:${req.view.crop.maxX}`]), widthPx: 400, heightPx: 400 },
        }),
      }),
      raster: () => ({ width: SIZE, height: SIZE, rgba: new Uint8ClampedArray(SIZE * SIZE * 4) }),
      api: {
        preflight: async () => ALLOWED,
        read: async (_bg, image, request) => {
          sent.push({ image, request });
          return h.answer(`sha:${await image.text()}`);
        },
      },
      hash: async (bytes) => `sha:${new TextDecoder().decode(bytes)}`,
      objectUrl: { create: () => `blob:${(urls += 1)}`, revoke: (url) => { revoked.push(url); } },
      adoptReading: (outcome) => { adopted.push(outcome); return 'source.v2'; },
      onViewCommitted: (view, before) => { committed.push({ view, before: before.view }); },
      onReviewReset: () => { resets.count += 1; },
      undoReadingDrop: () => h.restore,
    },
  };
  return h;
}

beforeEach(() => {
  planRecognitionStore.reset();
  planRecognitionStore.patch({ phase: 'ready', run: run() });
});

const review = () => planRecognitionStore.get().review;

describe('ADR-929 Φ5.3β — έλεγχος της όψης πριν την αποστολή', () => {
  it('begin: η πρόταση της ευθυγράμμισης, χωρίς πακέτο και χωρίς αποστολή', () => {
    const c = createPlanReadingReview(() => harness().deps);
    c.begin();
    expect(review()).toMatchObject({ view: { crop: { minX: 0, minY: 0, maxX: SIZE, maxY: SIZE }, redacted: [] }, tool: 'select', packet: null });
  });

  it('prepare: πακέτο από τα ΙΔΙΑ bytes (μικρογραφία + sha256) και προέλεγχος, παράλληλα', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const r = review();
    expect(r?.packet).toMatchObject({ previewUrl: 'blob:1', sha256: `sha:png:${SIZE}`, widthPx: 400, heightPx: 400 });
    expect(r?.packet?.segments.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(r?.preflight).toEqual({ status: 'done', result: ALLOWED });
  });

  it('κάθε επεξεργασία ΣΒΗΝΕΙ το πακέτο και ανακαλεί τη μικρογραφία: η αποστολή κλειδώνει', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const view = review()!.view;
    c.edit(addRedaction(view, { minX: 10, minY: 140, maxX: 80, maxY: 160 })!);
    expect(review()).toMatchObject({ packet: null, preflight: { status: 'idle' } });
    expect(h.revoked).toEqual(['blob:1']);
    expect(await c.send()).toBeNull();
    expect(h.sent).toHaveLength(0);
  });

  it('send: φεύγουν τα bytes ΚΑΙ η όψη του πακέτου· η απόκρυψη βγάζει το τμήμα που κάλυψε', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    c.edit(addRedaction(review()!.view, { minX: 10, minY: 140, maxX: 80, maxY: 160 })!);
    await c.prepare();
    const packet = review()!.packet!;
    expect(await c.send()).toBe('source.v2');
    expect(h.sent[0].image).toBe(packet.blob);
    expect(h.sent[0].request.view).toEqual(packet.view);
    expect(h.sent[0].request.segments.map((s) => s.id)).toEqual(['s1']);
    expect(h.adopted).toHaveLength(1);
    expect(review()?.send).toMatchObject({ status: 'read', cacheHit: false, counts: { texts: 0, dimensions: 0, rooms: 0, openings: 0 } });
  });

  it('απόδειξη παραλαβής: άλλο sha256 από τον διακομιστή ⇒ ΚΑΜΙΑ σύντηξη', async () => {
    const h = harness();
    h.answer = () => readAnswer('sha:something-else');
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    expect(await c.send()).toBeNull();
    expect(h.adopted).toHaveLength(0);
    expect(review()?.send).toEqual({ status: 'receipt-mismatch' });
  });

  it('άρνηση (νομική πύλη): ο λόγος με όνομα, η γεωμετρία μένει ως έχει', async () => {
    const h = harness();
    h.answer = () => ({ status: 'unavailable', reason: 'ai-legal-disclosure-pending', readingId: null });
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    expect(await c.send()).toBeNull();
    expect(h.adopted).toHaveLength(0);
    expect(review()?.send).toEqual({ status: 'unavailable', reason: 'ai-legal-disclosure-pending' });
  });

  it('προέλεγχος «όχι» ⇒ η αποστολή δεν γίνεται καν (κανένα αίτημα)', async () => {
    const h = harness();
    const refused: PlanReadingPreflightResult = { status: 'unavailable', reason: 'ai-disabled-for-company' };
    const c = createPlanReadingReview(() => ({ ...h.deps, api: { ...h.deps.api, preflight: async () => refused } }));
    c.begin();
    await c.prepare();
    expect(await c.send()).toBeNull();
    expect(h.sent).toHaveLength(0);
  });

  it('προέλεγχος που απέτυχε (δίκτυο) ⇒ fail-closed', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => ({ ...h.deps, api: { ...h.deps.api, preflight: async () => { throw new Error('net'); } } }));
    c.begin();
    await c.prepare();
    expect(review()?.preflight).toEqual({ status: 'failed' });
    expect(await c.send()).toBeNull();
  });

  it('αγώνας: νέα αναγνώριση ενώ ετοιμάζεται ⇒ το παλιό πακέτο αγνοείται και ανακαλείται', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    const pending = c.prepare();
    planRecognitionStore.patch({ run: run('rec2') });
    await pending;
    expect(review()?.packet).toBeNull();
    expect(h.revoked).toEqual(['blob:1']);
  });

  it('αγώνας: νέα αναγνώριση ενώ στέλνεται ⇒ η απάντηση δεν μπαίνει στη σύντηξη', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const pending = c.send();
    planRecognitionStore.patch({ run: run('rec2') });
    expect(await pending).toBeNull();
    expect(h.adopted).toHaveLength(0);
  });

  it('όσο στέλνεται, η όψη ΔΕΝ αλλάζει (το πακέτο που φεύγει μένει αυτό που φαίνεται)', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const before = review()!.view;
    const pending = c.send();
    c.edit(addRedaction(before, { minX: 10, minY: 10, maxX: 50, maxY: 50 })!);
    expect(review()!.view).toBe(before);
    await pending;
  });

  it('Προσθήκη περιοχής: εναλλαγή εργαλείου, και πίσω στην επιλογή μετά από κάθε αλλαγή', () => {
    const c = createPlanReadingReview(() => harness().deps);
    c.begin();
    c.toggleAddRegion();
    expect(review()?.tool).toBe('add-redaction');
    c.edit(addRedaction(review()!.view, { minX: 10, minY: 10, maxX: 50, maxY: 50 })!);
    expect(review()?.tool).toBe('select');
  });

  it('end: κλείνει την όψη και ανακαλεί τη μικρογραφία', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    c.end();
    expect(review()).toBeNull();
    expect(h.revoked).toEqual(['blob:1']);
  });
});

describe('ADR-929 §6.10 Α2 — η όψη οδηγεί τους τοίχους', () => {
  const CROPPED: PlanReadingView = { crop: { minX: 0, minY: 0, maxX: 120, maxY: SIZE }, redacted: [] };

  it('κάθε δεσμευμένη αλλαγή (και η «Επαναφορά πρότασης») πάει στους τοίχους, με την όψη ΠΡΙΝ την αλλαγή', () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    const proposed = review()!.view;
    c.edit(CROPPED);
    c.reset();
    expect(h.committed).toEqual([{ view: CROPPED, before: proposed }, { view: proposed, before: CROPPED }]);
  });

  it('όσο στέλνεται, καμία αλλαγή δεν φτάνει στους τοίχους', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const pending = c.send();
    c.edit(CROPPED);
    await pending;
    expect(h.committed).toHaveLength(0);
  });

  it('begin/end ακυρώνουν ό,τι τρέχει για τους τοίχους· begin ανοίγει στην όψη ΑΠΟ ΤΗΝ ΟΠΟΙΑ βγήκαν οι τοίχοι', () => {
    const h = harness();
    planRecognitionStore.patch({ run: { ...run(), maskView: CROPPED } });
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    expect(review()).toMatchObject({ view: CROPPED, walls: { status: 'following', readingDropped: false } });
    expect(review()!.proposed.crop).toEqual({ minX: 0, minY: 0, maxX: SIZE, maxY: SIZE });
    c.end();
    expect(h.resets.count).toBe(2);
  });

  it('όσο οι τοίχοι ξαναβγαίνουν, ο «Έλεγχος» δεν ξεκινά (το πακέτο θα είχε τμήματα άλλης όψης)', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    planRecognitionStore.patch({ review: { ...review()!, walls: { status: 'updating', readingDropped: false } } });
    await c.prepare();
    expect(review()).toMatchObject({ packet: null, preflight: { status: 'idle' }, send: { status: 'idle' } });
  });

  it('Αναίρεση: η όψη και η κατάσταση αποστολής πριν την πρώτη αλλαγή· το πακέτο σβήνει και ανακαλείται', async () => {
    const h = harness();
    const read = { status: 'read', counts: { texts: 1, dimensions: 2, rooms: 0, openings: 0 }, cacheHit: false } as const;
    h.restore = { view: CROPPED, send: read };
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    planRecognitionStore.patch({ review: { ...review()!, walls: { status: 'following', readingDropped: true } } });
    await c.prepare();
    c.undoReadingDrop();
    expect(review()).toMatchObject({ view: CROPPED, send: read, packet: null, walls: { status: 'following', readingDropped: false } });
    expect(h.revoked).toEqual(['blob:1']);
  });

  it('Αναίρεση χωρίς τίποτα να αναιρεθεί ⇒ καμία αλλαγή (το πακέτο μένει)', async () => {
    const h = harness();
    const c = createPlanReadingReview(() => h.deps);
    c.begin();
    await c.prepare();
    const before = review();
    c.undoReadingDrop();
    expect(review()).toBe(before);
    expect(h.revoked).toEqual([]);
  });
});
