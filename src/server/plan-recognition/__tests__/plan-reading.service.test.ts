/**
 * @jest-environment node
 *
 * ADR-929 Φ3 — η ανάγνωση κάτοψης από άκρη σε άκρη, πάνω στον **πραγματικό** store (μία-πτήση, δέσμη ανάγνωσης +
 * δαπάνης), στο **πραγματικό** όριο και στο επαληθευμένο ψεύτικο Firestore. Ο αναγνώστης είναι ψεύτικος: καμία
 * πληρωμένη κλήση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { BackgroundNotFoundError } from '@/services/floorplan-background/background-ownership';
import type { PlanReader, PlanReaderOutcome } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port';
import type { PlanReadingRequest } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';
import type { PlanViewReading } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-wire';
import { resolvePlanReadingAllowance } from '../plan-reading-allowance.server';
import { readPlanForBackground, type PlanReadingDeps } from '../plan-reading.service';
import { claimPlanReading, recordPlanReadingCacheHit, settlePlanReading, PLAN_READING_LEASE_MS } from '../plan-reading-store.server';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

const COMPANY = 'comp_a';
const READING: PlanViewReading = { texts: [], dimensions: [], writtenScale: null, rooms: [], openings: [] };
const REQUEST: PlanReadingRequest = {
  view: { crop: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, redacted: [] },
  segments: [{ id: 'ps0', x0: 0, y0: 0, x1: 1000, y1: 0, style: 'stroke' }],
};
const IMAGE = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' as const, widthPx: 10, heightPx: 10 };

interface FakeReader extends PlanReader {
  calls: number;
}

function fakeReader(outcome: Partial<PlanReaderOutcome> = {}, estimate: number | null = 0.05): FakeReader {
  const reader: FakeReader = {
    calls: 0,
    model: 'gpt-test',
    estimateCostUsd: () => estimate,
    read: async () => {
      reader.calls += 1;
      return {
        kind: 'read', model: 'gpt-test', reading: READING,
        dropped: { unknownSegmentRefs: 0, unknownTextRefs: 0, openingsWithoutHost: 0 },
        usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.04 }, latencyMs: 5,
        ...outcome,
      } as PlanReaderOutcome;
    },
  };
  return reader;
}

function deps(reader: PlanReader | null, overrides: Partial<PlanReadingDeps> = {}): PlanReadingDeps {
  return {
    background: async (id, companyId) => (id === 'rbg_1' && companyId === COMPANY ? { fileId: 'file_1', pageNumber: 1 } : null),
    reader: () => reader,
    allowance: (companyId, estimate) => resolvePlanReadingAllowance(companyId, estimate),
    claim: claimPlanReading,
    settle: settlePlanReading,
    cacheHit: recordPlanReadingCacheHit,
    now: () => 1_000_000,
    ...overrides,
  };
}

const command = (backgroundId = 'rbg_1') => ({ companyId: COMPANY, uid: 'u1', backgroundId, image: IMAGE, request: REQUEST });
const spendDoc = () => fake.all<Record<string, unknown>>(COLLECTIONS.AI_USAGE)[0];

beforeEach(() => {
  fake.seedCollection(COLLECTIONS.PLAN_READINGS, {});
  fake.seedCollection(COLLECTIONS.AI_USAGE, {});
});

describe('readPlanForBackground', () => {
  it('a foreign or missing background never reaches the provider', async () => {
    const reader = fakeReader();
    await expect(readPlanForBackground(command('rbg_other'), deps(reader))).rejects.toBeInstanceOf(BackgroundNotFoundError);
    expect(reader.calls).toBe(0);
  });

  it('reads once, stores the proof of what was sent, and books the cost in the same batch', async () => {
    const reader = fakeReader();
    const result = await readPlanForBackground(command(), deps(reader));
    expect(result).toMatchObject({ status: 'read', cacheHit: false, model: 'gpt-test' });
    const stored = fake.all<Record<string, unknown>>(COLLECTIONS.PLAN_READINGS)[0];
    expect(stored).toMatchObject({ status: 'read', companyId: COMPANY, fileId: 'file_1', pageNumber: 1, leaseUntil: null });
    expect(stored.sent).toMatchObject({ bytes: 3, segmentCount: 1, view: REQUEST.view });
    expect((stored.sent as { imageSha256: string }).imageSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(spendDoc()).toMatchObject({ companyId: COMPANY, channel: 'plan-reading', estimatedCostUsd: 0.04, cacheHits: 0 });
    expect(spendDoc().totalTokens).toEqual({ prompt: 1000, completion: 200 });
  });

  it('the same input again is a free cache hit: no second call, cost 0, saving counted', async () => {
    const reader = fakeReader();
    const first = await readPlanForBackground(command(), deps(reader));
    const second = await readPlanForBackground(command(), deps(reader));
    expect(reader.calls).toBe(1);
    expect(second).toMatchObject({ status: 'read', cacheHit: true });
    expect(second.status === 'read' && first.status === 'read' && second.readingId === first.readingId).toBe(true);
    expect(spendDoc()).toMatchObject({ estimatedCostUsd: 0.04, cacheHits: 1 });
  });

  it('the same image with different segments is a different question (new reading, new id)', async () => {
    const reader = fakeReader();
    await readPlanForBackground(command(), deps(reader));
    const other = { ...command(), request: { ...REQUEST, segments: [...REQUEST.segments, { ...REQUEST.segments[0], id: 'ps1' }] } };
    const result = await readPlanForBackground(other, deps(reader));
    expect(reader.calls).toBe(2);
    expect(result).toMatchObject({ cacheHit: false });
  });

  it('a cached reading is returned even when the monthly allowance is exhausted (already paid)', async () => {
    const reader = fakeReader();
    await readPlanForBackground(command(), deps(reader));
    const exhausted = deps(reader, { allowance: async () => ({ allowed: false, reason: 'allowance-exhausted' }) });
    expect(await readPlanForBackground(command(), exhausted)).toMatchObject({ status: 'read', cacheHit: true });
  });

  /** Αναγνώστης που «κολλάει» στην κλήση· το `started` λύνεται όταν η μίσθωση έχει ήδη γραφτεί. */
  function hangingReader(): { reader: PlanReader; started: Promise<void> } {
    let signal: () => void = () => undefined;
    const started = new Promise<void>((resolve) => { signal = resolve; });
    const reader: PlanReader = { model: 'gpt-test', estimateCostUsd: () => 0.05, read: () => { signal(); return new Promise<never>(() => undefined); } };
    return { reader, started };
  }

  it('a live lease means "in progress", never a second paid call', async () => {
    const hanging = hangingReader();
    void readPlanForBackground(command(), deps(hanging.reader));
    await hanging.started;
    const reader = fakeReader();
    expect(await readPlanForBackground(command(), deps(reader))).toEqual(expect.objectContaining({ status: 'unavailable', reason: 'reading-in-progress' }));
    expect(reader.calls).toBe(0);
  });

  it('an expired lease is taken over', async () => {
    const hanging = hangingReader();
    void readPlanForBackground(command(), deps(hanging.reader));
    await hanging.started;
    const reader = fakeReader();
    const later = deps(reader, { now: () => 1_000_000 + PLAN_READING_LEASE_MS + 1 });
    expect(await readPlanForBackground(command(), later)).toMatchObject({ status: 'read', cacheHit: false });
    expect(reader.calls).toBe(1);
  });

  it.each([
    ['cost-unknown', null],
    ['page-cost-exceeds-cap', 10],
  ] as const)('refuses before any lease or call: %s', async (reason, estimate) => {
    const reader = fakeReader({}, estimate);
    expect(await readPlanForBackground(command(), deps(reader))).toEqual({ status: 'unavailable', reason, readingId: null });
    expect(reader.calls).toBe(0);
    expect(fake.all(COLLECTIONS.PLAN_READINGS)).toHaveLength(0);
  });

  it('a failed read is recorded as failed, still pays, and can be retried', async () => {
    const reader = fakeReader({ kind: 'failed', failure: 'unparseable', detail: 'x' } as Partial<PlanReaderOutcome>);
    expect(await readPlanForBackground(command(), deps(reader))).toMatchObject({ status: 'unavailable', reason: 'reader-failed' });
    expect(fake.all<Record<string, unknown>>(COLLECTIONS.PLAN_READINGS)[0]).toMatchObject({ status: 'failed', failure: 'unparseable' });
    expect(spendDoc()).toMatchObject({ estimatedCostUsd: 0.04 });
    await readPlanForBackground(command(), deps(reader));
    expect(reader.calls).toBe(2);
  });

  it('without a provider key the flow says so, and nothing is written', async () => {
    expect(await readPlanForBackground(command(), deps(null))).toEqual({ status: 'unavailable', reason: 'reader-unconfigured', readingId: null });
    expect(fake.all(COLLECTIONS.PLAN_READINGS)).toHaveLength(0);
  });
});

describe('resolvePlanReadingAllowance', () => {
  const limits = { pageCapUsd: 0.25, monthlyCapUsd: 1 };

  it('allows within both caps and reports what remains', async () => {
    expect(await resolvePlanReadingAllowance(COMPANY, 0.1, { limits, monthlySpendUsd: async () => 0.5 })).toEqual({ allowed: true, remainingUsd: 0.5 });
  });

  it('refuses when the month cannot cover the estimate', async () => {
    expect(await resolvePlanReadingAllowance(COMPANY, 0.1, { limits, monthlySpendUsd: async () => 0.95 })).toEqual({ allowed: false, reason: 'allowance-exhausted' });
  });

  it('fails closed when the spend cannot be read', async () => {
    const r = await resolvePlanReadingAllowance(COMPANY, 0.1, { limits, monthlySpendUsd: async () => { throw new Error('down'); } });
    expect(r).toEqual({ allowed: false, reason: 'allowance-unverifiable' });
  });
});
