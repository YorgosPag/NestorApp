/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **το backfill εφαρμόζει τον ίδιο κανόνα με τον trigger** (ADR-829 §7).
 *
 * Το backfill είναι το βήμα που καθαρίζει τα ονόματα των WIP από το ευρετήριο. Αν απλώς τα
 * παρέλειπε, οι παλιές εγγραφές θα έμεναν στη θέση τους για πάντα.
 */

import { backfillEntityType } from '../backfill-engine';

const mockSource: { docs: Array<Record<string, unknown>> } = { docs: [] };
const mockWritten: Array<{ id: string; data: Record<string, unknown> }> = [];
const mockTombstone = jest.fn(async (..._args: unknown[]) => 'applied');

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/search/search-index-write', () => ({
  entityCommitVersion: () => ({ seconds: 7, nanoseconds: 0 }),
  writeSearchIndexTombstone: (...args: unknown[]) => mockTombstone(...args),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  const sourceQuery = {
    where: () => sourceQuery,
    limit: () => sourceQuery,
    get: async () => ({
      size: mockSource.docs.length,
      docs: mockSource.docs.map(({ id, ...data }) => ({ id, data: () => data })),
    }),
  };
  const bulkWriter = {
    set: async (ref: { id: string }, data: Record<string, unknown>) => {
      mockWritten.push({ id: ref.id, data });
    },
    flush: async () => undefined,
    close: async () => undefined,
  };
  const db = {
    collection: () => ({ ...sourceQuery, doc: (id: string) => ({ id }) }),
    bulkWriter: () => bulkWriter,
  };
  return { getAdminFirestore: () => db };
});

const FILE = { companyId: 'co_a', displayName: 'Κάτοψη', status: 'ready' };

beforeEach(() => {
  mockSource.docs = [];
  mockWritten.length = 0;
  mockTombstone.mockClear();
});

describe('backfill — WIP και αποσυρμένα βγαίνουν, δεν παραλείπονται', () => {
  it('Τ1 — WIP: ταφόπλακα με την έκδοση της οντότητας, καμία ζωντανή εγγραφή', async () => {
    mockSource.docs = [{ id: 'f1', ...FILE, cdeReadReach: 'author' }];
    const stats = await backfillEntityType('file', {});
    expect(stats).toMatchObject({ withdrawn: 1, indexed: 0 });
    expect(mockWritten).toEqual([]);
    expect(mockTombstone.mock.calls[0][1]).toBe('file_f1');
    expect(mockTombstone.mock.calls[0][2]).toEqual({ tenantId: 'co_a', entityType: 'file', entityId: 'f1' });
    expect(mockTombstone.mock.calls[0][3]).toEqual({ seconds: 7, nanoseconds: 0 });
  });

  it('Τ2 — dryRun: μετρά, δεν γράφει', async () => {
    mockSource.docs = [{ id: 'f1', ...FILE, cdeReadReach: 'author' }];
    const stats = await backfillEntityType('file', { dryRun: true });
    expect(stats.withdrawn).toBe(1);
    expect(mockTombstone).not.toHaveBeenCalled();
  });

  it('Τ3 — αρχειοθετημένο: ο ίδιος κανόνας με τον trigger', async () => {
    mockSource.docs = [{ id: 'p1', companyId: 'co_a', name: 'Έργο', status: 'archived' }];
    const stats = await backfillEntityType('project', {});
    expect(stats.withdrawn).toBe(1);
    expect(mockWritten).toEqual([]);
  });

  it('Τ4 — αποτυχία ταφόπλακας: μετριέται ως σφάλμα, όχι ως επιτυχία', async () => {
    mockTombstone.mockRejectedValueOnce(new Error('boom'));
    mockSource.docs = [{ id: 'f1', ...FILE, cdeReadReach: 'author' }];
    const stats = await backfillEntityType('file', {});
    expect(stats).toMatchObject({ withdrawn: 0, errors: 1 });
  });
});

describe('backfill — ό,τι μένει, γράφεται σωστά', () => {
  it('Τ5 — αρχείο εμβέλειας γραφείου: παίρνει τη σφραγίδα', async () => {
    mockSource.docs = [{ id: 'f1', ...FILE, cdeReadReach: 'tenant' }];
    await backfillEntityType('file', {});
    expect(mockWritten[0].id).toBe('file_f1');
    expect(mockWritten[0].data.readReach).toBe('tenant');
    expect(mockTombstone).not.toHaveBeenCalled();
  });

  it('Τ6 — όροφος: το href λύνει και το `buildingId`, όπως ο trigger', async () => {
    mockSource.docs = [{ id: 'fl1', companyId: 'co_a', name: 'Ο1', buildingId: 'bld_9' }];
    await backfillEntityType('floor', {});
    const links = mockWritten[0].data.links as { href: string };
    expect(links.href).toBe('/buildings?buildingId=bld_9&floor=fl1');
  });
});
