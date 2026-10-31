/**
 * ADR-923 §5.6.1 — η **σειρά** των βημάτων είναι η εγγύηση: hold πριν από τη λήψη, άρση hold πριν από τη διαγραφή, κάδος πριν από
 * την ταφόπλακα. Ο ψεύτικος κάδος καταγράφει τη σειρά και αρνείται διαγραφή με hold, όπως η πλατφόρμα.
 */
import type { AuthContext } from '@/lib/auth';
import { EMPTY_PUBLICATION_RETENTION, type PublicationRetention } from '@/subapps/catalog/types/publication';
import type { Firestore } from 'firebase-admin/firestore';
import {
  deletePublicationPdf,
  placePublicationLegalHold,
  recordPublicationDownload,
  releasePublicationLegalHold,
  runPublicationRetention,
} from '../publication-retention.server';
import type { StoredPublicationRun } from '../publication-run.server';

const mockOrder: string[] = [];
const mockHeld = new Set<string>();
const mockObjects = new Set<string>();
const mockRuns = new Map<string, StoredPublicationRun>();
const mockBucket = { refuseDelete: false };

jest.mock('../publication-bucket.server', () => ({
  publicationBucket: () => ({
    file: (path: string) => ({
      exists: async () => [mockObjects.has(path)],
      setMetadata: async ({ temporaryHold }: { readonly temporaryHold: boolean }) => {
        if (!mockObjects.has(path)) throw new Error('404');
        mockOrder.push(`hold:${temporaryHold}`);
        if (temporaryHold) mockHeld.add(path); else mockHeld.delete(path);
      },
      delete: async () => {
        if (mockBucket.refuseDelete || mockHeld.has(path)) throw new Error('object is under hold');
        mockOrder.push('delete');
        mockObjects.delete(path);
      },
    }),
  }),
}));
jest.mock('../publication-run.server', () => ({
  readOwnedPublicationRun: jest.fn(async (ctx: { readonly companyId: string }, id: string) => {
    const run = mockRuns.get(id);
    return run?.companyId === ctx.companyId ? run : null;
  }),
  changePublicationRun: jest.fn(async (id: string, _actor: string, change: (run: StoredPublicationRun) => Partial<StoredPublicationRun> | null) => {
    const run = mockRuns.get(id) as StoredPublicationRun;
    const patch = change(run);
    if (patch === null) return run;
    mockOrder.push('record');
    const after = { ...run, ...patch };
    mockRuns.set(id, after);
    return after;
  }),
}));
jest.mock('../../price-version-reads.server', () => ({ readListVersionsSnapshot: jest.fn(async () => []) }));

const PATH = 'catalog-publications/c/r1/print.pdf';
const ctx = { companyId: 'c', uid: 'u1' } as unknown as AuthContext;

function seed(retention: Partial<PublicationRetention> = {}, dispositionDueAt: string | null = null): StoredPublicationRun {
  const run = {
    id: 'r1',
    companyId: 'c',
    status: 'ready',
    priced: false,
    priceVersion: null,
    artifacts: [{ profile: 'print', storagePath: PATH, sha256: 'abc' }],
    retention: { ...EMPTY_PUBLICATION_RETENTION, ...retention },
    dispositionDueAt,
  } as unknown as StoredPublicationRun;
  mockRuns.set('r1', run);
  return run;
}

const stored = () => mockRuns.get('r1') as StoredPublicationRun;
const sweepDb = (runs: readonly StoredPublicationRun[]) => ({
  collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ size: runs.length, docs: runs.map((run) => ({ data: () => run })) }) }) }) }),
}) as unknown as Firestore;

const issuesOf = (work: Promise<unknown>) => work.then(() => [], (cause: { readonly issues: readonly { readonly code: string }[] }) => cause.issues.map((issue) => issue.code));

beforeEach(() => {
  mockOrder.length = 0;
  mockBucket.refuseDelete = false;
  mockHeld.clear();
  mockRuns.clear();
  mockObjects.clear();
  mockObjects.add(PATH);
});

describe('λήψη', () => {
  it('η πρώτη βάζει hold πριν από την καταγραφή, οι επόμενες δεν το ξαναγγίζουν', async () => {
    await recordPublicationDownload(ctx, seed());
    expect(mockOrder).toEqual(['hold:true', 'record']);
    expect(stored().retention.downloadCount).toBe(1);
    mockOrder.length = 0;
    await recordPublicationDownload(ctx, stored());
    expect(mockOrder).toEqual(['record']);
    expect(stored().retention.downloadCount).toBe(2);
  });

  it('αν η διάθεση προλάβει, δεν καταγράφεται λήψη και δεν σερβίρεται τίποτα', async () => {
    mockObjects.clear();
    await expect(recordPublicationDownload(ctx, seed())).rejects.toThrow('404');
    expect(stored().retention.downloadCount).toBe(0);
  });
});

describe('χειροκίνητη διαγραφή', () => {
  it('σβήνει τα bytes πριν από την ταφόπλακα, και το αποτύπωμα μένει', async () => {
    seed();
    await deletePublicationPdf(ctx, 'r1');
    expect(mockOrder).toEqual(['hold:false', 'delete', 'record']);
    expect(stored().retention.disposal).toMatchObject({ disposedBy: 'u1', cause: 'manual' });
    expect(stored().artifacts[0].sha256).toBe('abc');
  });

  it('αρνείται έκδοση που κατέβηκε, και ξένη έκδοση ≡ ανύπαρκτη', async () => {
    seed({ downloadCount: 1 });
    await expect(issuesOf(deletePublicationPdf(ctx, 'r1'))).resolves.toEqual(['publicationNotDeletable']);
    expect(mockObjects.has(PATH)).toBe(true);
    await expect(issuesOf(deletePublicationPdf({ ...ctx, companyId: 'other' }, 'r1'))).resolves.toEqual(['unknownReference']);
  });
});

describe('δικαστική δέσμευση', () => {
  it('μπαίνει με hold στην πλατφόρμα και δεν αντικαθίσταται σιωπηλά', async () => {
    seed();
    await placePublicationLegalHold(ctx, 'r1', 'δίκη');
    expect(mockHeld.has(PATH)).toBe(true);
    expect(stored().retention.legalHold).toMatchObject({ reason: 'δίκη', placedBy: 'u1' });
    await expect(issuesOf(placePublicationLegalHold(ctx, 'r1', 'άλλη'))).resolves.toEqual(['publicationAlreadyOnHold']);
  });

  it('η άρση αφήνει το hold αν το κρατά και η λήψη', async () => {
    seed({ downloadCount: 1, legalHold: { placedBy: 'u', placedAt: 't', reason: 'x' } });
    mockHeld.add(PATH);
    await releasePublicationLegalHold(ctx, 'r1');
    expect(mockHeld.has(PATH)).toBe(true);
    expect(stored().retention.legalHold).toBeNull();
  });

  it('χωρίς λήψη, η άρση ελευθερώνει το αντικείμενο, μετά την εγγραφή', async () => {
    seed({ legalHold: { placedBy: 'u', placedAt: 't', reason: 'x' } });
    mockHeld.add(PATH);
    await releasePublicationLegalHold(ctx, 'r1');
    expect(mockOrder).toEqual(['record', 'hold:false']);
  });
});

describe('σάρωση', () => {
  const NOW = '2027-01-01T00:00:00.000Z';

  it('διαθέτει ό,τι έληξε, με δράστη το σύστημα και αιτία `schedule`', async () => {
    const run = seed({ supersededAt: '2026-01-01T00:00:00.000Z' }, '2026-04-01T00:00:00.000Z');
    await expect(runPublicationRetention(sweepDb([run]), 20, NOW)).resolves.toMatchObject({ considered: 1, disposed: 1, failed: 0 });
    expect(stored().retention.disposal).toMatchObject({ cause: 'schedule', disposedBy: 'system:cron-publication-retention' });
    expect(stored().dispositionDueAt).toBeNull();
  });

  it('έκδοση με τιμές που ισχύουν ακόμη αναβάλλεται και μένει το αρχείο', async () => {
    const run = seed({ supersededAt: '2020-01-01T00:00:00.000Z', downloadCount: 1 }, '2026-12-31T22:00:00.000Z');
    mockRuns.set('r1', { ...run, priced: true, priceVersion: { priceListId: 'l', priceListVersionId: 'v' } });
    await expect(runPublicationRetention(sweepDb([stored()]), 20, NOW)).resolves.toMatchObject({ deferred: 1, disposed: 0 });
    expect(mockObjects.has(PATH)).toBe(true);
    expect(stored().dispositionDueAt).toBe('2028-01-01T00:00:00.000Z');
  });

  it('ο κάδος αρνείται ⇒ καμία ταφόπλακα, μετριέται ως αποτυχία και ξανακρίνεται', async () => {
    const run = seed({ supersededAt: '2026-01-01T00:00:00.000Z' }, '2026-04-01T00:00:00.000Z');
    mockBucket.refuseDelete = true;
    await expect(runPublicationRetention(sweepDb([run]), 20, NOW)).resolves.toMatchObject({ failed: 1, disposed: 0 });
    expect(stored().retention.disposal).toBeNull();
  });
});
