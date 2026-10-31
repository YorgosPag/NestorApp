/**
 * Η μετάπτωση αγγίζει μόνο ψευδές `master` — ADR-923 §5.11 «3ε».
 */

import { migrateBoqPriceAuthority, needsAuthorityFix } from '../migration-operations';

jest.mock('server-only', () => ({}));

type Doc = { readonly id: string; readonly data: Record<string, unknown> };

function fakeDb(docs: readonly Doc[]) {
  const updates: Array<{ id: string; fields: Record<string, unknown> }> = [];
  const db = {
    collection: () => ({
      where: (_field: string, _op: string, value: unknown) => ({
        get: async () => {
          const matching = docs.filter((doc) => doc.data.priceAuthority === value);
          return { size: matching.length, docs: matching.map((doc) => ({ data: () => doc.data, ref: doc.id })) };
        },
      }),
    }),
    batch: () => ({
      update: (ref: string, fields: Record<string, unknown>) => updates.push({ id: ref, fields }),
      commit: async () => undefined,
    }),
  };
  return { db: db as unknown as Parameters<typeof migrateBoqPriceAuthority>[0], updates };
}

const DOCS: readonly Doc[] = [
  { id: 'false-master', data: { priceAuthority: 'master', priceSource: null } },
  { id: 'absent-link', data: { priceAuthority: 'master' } },
  { id: 'true-master', data: { priceAuthority: 'master', priceSource: { lineId: 'l' } } },
  { id: 'typed', data: { priceAuthority: 'item' } },
];

describe('needsAuthorityFix', () => {
  it('μόνο master χωρίς δεσμό', () => {
    expect(DOCS.map((doc) => needsAuthorityFix(doc.data))).toEqual([true, true, false, false]);
  });
});

describe('migrateBoqPriceAuthority', () => {
  it('dry-run: αναφέρει, δεν γράφει', async () => {
    const { db, updates } = fakeDb(DOCS);
    await expect(migrateBoqPriceAuthority(db, true)).resolves.toEqual({ dryRun: true, scanned: 3, affectedDocuments: 2, skippedLinked: 1 });
    expect(updates).toEqual([]);
  });

  it('εκτέλεση: item μόνο στις ψευδείς, χωρίς να αγγίζει τιμές', async () => {
    const { db, updates } = fakeDb(DOCS);
    await migrateBoqPriceAuthority(db, false);
    expect(updates.map((update) => update.id)).toEqual(['false-master', 'absent-link']);
    expect(Object.keys(updates[0].fields).sort()).toEqual(['priceAuthority', 'updatedAt']);
    expect(updates[0].fields.priceAuthority).toBe('item');
  });
});
