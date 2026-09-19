/**
 * @fileoverview **Το backfill ΤΕΛΕΙΩΝΕΙ όταν η δέσμη δεν γεμίζει** (ADR-777 §8.60.20.9 #4).
 *
 * 🔴 Μετρημένο 2026-09-19 στην παραγωγή: `POST /api/admin/search-backfill { type: 'parking',
 * dryRun: false }` με **2** θέσεις κρέμασε δύο φορές, **μηδέν** εγγραφές. Το `backfillEntityType`
 * περίμενε τις υποσχέσεις των `set()` πριν από οποιοδήποτε `flush`/`close` — και ο **κοινός**
 * writer του `backfillAllTypesParallel` κλείνει **μετά** από αυτή την αναμονή ⇒ αδιέξοδο.
 *
 * Ο ψεύτικος writer μιμείται το **πραγματικό** συμβόλαιο του BulkWriter: μια εγγραφή
 * ολοκληρώνεται **μόνο** σε `flush()`/`close()` (όχι μόνη της, για δέσμη που δεν γέμισε).
 */

import type { SearchEntityType } from '@/types/search';

interface PendingWrite {
  readonly id: string;
  readonly resolve: () => void;
}

const committed: string[] = [];
let pending: PendingWrite[] = [];

const commitPending = async (): Promise<void> => {
  const batch = pending;
  pending = [];
  for (const write of batch) {
    committed.push(write.id);
    write.resolve();
  }
};

const fakeBulkWriter = {
  set: (ref: { id: string }) =>
    new Promise<void>((resolve) => {
      pending.push({ id: ref.id, resolve });
    }),
  flush: jest.fn(commitPending),
  close: jest.fn(commitPending),
};

const PARKING_DOCS = [
  { id: 'park_a', data: () => ({ companyId: 'comp_x', number: 'A', type: 'standard', commercialStatus: 'for-rent' }) },
  { id: 'park_b', data: () => ({ companyId: 'comp_x', number: 'B', type: 'standard', commercialStatus: 'for-sale' }) },
];

const fakeDb = {
  bulkWriter: () => fakeBulkWriter,
  collection: (name: string) => {
    const query = {
      where: () => query,
      limit: () => query,
      get: async () => ({ size: name === 'search_documents' ? 0 : PARKING_DOCS.length, docs: PARKING_DOCS }),
      doc: (id: string) => ({ id }),
    };
    return query;
  },
};

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => fakeDb }));

/** Αδιέξοδο ⇒ ποτέ δεν επιλύεται· το δείχνουμε ως «TIMEOUT» αντί να κρεμάσει η σουίτα. */
const withinOneSecond = <T>(work: Promise<T>): Promise<T | 'TIMEOUT'> =>
  Promise.race([work, new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 1000))]);

describe('backfill-engine — ο κοινός BulkWriter δεν κλειδώνει σε μη γεμάτη δέσμη', () => {
  beforeEach(() => {
    committed.length = 0;
    pending = [];
    jest.clearAllMocks();
  });

  it('Β1 🔴 το dryRun:false με 2 έγγραφα ΟΛΟΚΛΗΡΩΝΕΤΑΙ και γράφει και τα δύο', async () => {
    const { backfillAllTypesParallel } = await import('../backfill-engine');
    const types: SearchEntityType[] = ['parking'];

    const result = await withinOneSecond(backfillAllTypesParallel(types, { dryRun: false }));

    expect(result).not.toBe('TIMEOUT');
    expect(committed.sort()).toEqual(['parking_park_a', 'parking_park_b']);
    expect(result !== 'TIMEOUT' && result.totalStats).toMatchObject({ indexed: 2, errors: 0 });
  });

  it('Β2 το dryRun:true δεν γράφει τίποτα και δεν αγγίζει τον writer', async () => {
    const { backfillAllTypesParallel } = await import('../backfill-engine');

    const result = await withinOneSecond(backfillAllTypesParallel(['parking'], { dryRun: true }));

    expect(result).not.toBe('TIMEOUT');
    expect(committed).toEqual([]);
    expect(fakeBulkWriter.flush).not.toHaveBeenCalled();
  });
});
