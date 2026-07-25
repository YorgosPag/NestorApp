/**
 * Unit tests — admin-batch-utils SSoT primitives (ADR-704 Φ1).
 *
 * These are the shared building blocks admin backfills copy-pasted before
 * ADR-704 centralised them. The tests pin the observable contract:
 *   - buildLookupCache: cursor-paginated `.select` → Map, skipping falsy values
 *   - flushInBatches:   chunked batch.update, per-batch resilience (one bad
 *                       batch is recorded, not fatal)
 *
 * Firestore is faked in-memory (the primitives take `db`/`queryRef` as params,
 * so no module mock is needed).
 */

import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  UpdateData,
} from 'firebase-admin/firestore';
import { buildLookupCache, flushInBatches, type BatchUpdate } from '../admin-batch-utils';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  data: Record<string, unknown>;
}

/** Chainable query double that paginates via limit()/startAfter() like the real SDK. */
class FakeQuery {
  private afterId: string | undefined;
  private lim = Number.POSITIVE_INFINITY;

  constructor(private readonly rows: Row[]) {}

  select(): this { return this; }
  orderBy(): this { return this; }
  limit(n: number): this { this.lim = n; return this; }
  startAfter(doc: { id: string }): this { this.afterId = doc.id; return this; }

  async get() {
    let slice = this.rows;
    if (this.afterId !== undefined) {
      const idx = this.rows.findIndex(r => r.id === this.afterId);
      slice = this.rows.slice(idx + 1);
    }
    const page = slice.slice(0, this.lim);
    const docs = page.map(r => ({
      id: r.id,
      ref: { id: r.id },
      data: () => r.data,
      get: (field: string) => r.data[field],
    }));
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

function fakeQuery(rows: Row[]): CollectionReference<DocumentData> {
  return new FakeQuery(rows) as unknown as CollectionReference<DocumentData>;
}

function fakeDb(failBatchIndexes = new Set<number>()) {
  const committed: BatchUpdate[][] = [];
  let batchIndex = -1;

  const db = {
    batch() {
      batchIndex += 1;
      const myIndex = batchIndex;
      const ops: BatchUpdate[] = [];
      return {
        update(ref: DocumentReference, data: UpdateData<DocumentData>) {
          ops.push({ ref, data } as BatchUpdate);
        },
        async commit() {
          if (failBatchIndexes.has(myIndex)) throw new Error(`batch ${myIndex} failed`);
          committed.push(ops);
        },
      };
    },
  };

  return { db: db as unknown as Firestore, committed };
}

function ref(id: string): DocumentReference<DocumentData> {
  return { id } as unknown as DocumentReference<DocumentData>;
}

// ---------------------------------------------------------------------------
// buildLookupCache
// ---------------------------------------------------------------------------

describe('buildLookupCache', () => {
  it('maps docId → field value and skips falsy values', async () => {
    const cache = await buildLookupCache(
      fakeQuery([
        { id: 'a', data: { companyId: 'comp_1' } },
        { id: 'b', data: { companyId: '' } },        // falsy → skipped
        { id: 'c', data: { companyId: 'comp_3' } },
        { id: 'd', data: {} },                        // missing → skipped
      ]),
      'companyId',
    );

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe('comp_1');
    expect(cache.get('c')).toBe('comp_3');
    expect(cache.has('b')).toBe(false);
    expect(cache.has('d')).toBe(false);
  });

  it('paginates across pages when batchSize < total', async () => {
    const rows: Row[] = [
      { id: 'a', data: { companyId: 'c1' } },
      { id: 'b', data: { companyId: 'c2' } },
      { id: 'c', data: { companyId: 'c3' } },
      { id: 'd', data: { companyId: 'c4' } },
      { id: 'e', data: { companyId: 'c5' } },
    ];

    const cache = await buildLookupCache(fakeQuery(rows), 'companyId', 2);

    expect(cache.size).toBe(5);
    expect([...cache.keys()]).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(cache.get('e')).toBe('c5');
  });

  it('returns an empty Map for an empty collection', async () => {
    const cache = await buildLookupCache(fakeQuery([]), 'companyId');
    expect(cache.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// flushInBatches
// ---------------------------------------------------------------------------

describe('flushInBatches', () => {
  const updates = (ids: string[]): BatchUpdate[] =>
    ids.map(id => ({ ref: ref(id), data: { companyId: `co_${id}` } }));

  it('commits everything in a single batch when under the limit', async () => {
    const { db, committed } = fakeDb();

    const result = await flushInBatches(db, updates(['a', 'b', 'c']));

    expect(result.written).toBe(3);
    expect(result.errors).toEqual([]);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toHaveLength(3);
  });

  it('chunks into multiple batches at batchSize', async () => {
    const { db, committed } = fakeDb();

    const result = await flushInBatches(db, updates(['a', 'b', 'c', 'd', 'e']), 2);

    expect(result.written).toBe(5);
    expect(result.errors).toEqual([]);
    expect(committed.map(b => b.length)).toEqual([2, 2, 1]);
  });

  it('records a failing batch but still commits the others (resilience)', async () => {
    const { db, committed } = fakeDb(new Set([0])); // first chunk fails

    const result = await flushInBatches(db, updates(['a', 'b', 'c']), 2);

    expect(result.written).toBe(1);              // only the second chunk (['c'])
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Batch 1');
    expect(committed).toHaveLength(1);
    expect(committed[0]).toHaveLength(1);
  });

  it('does nothing for an empty update list', async () => {
    const { db, committed } = fakeDb();

    const result = await flushInBatches(db, []);

    expect(result.written).toBe(0);
    expect(result.errors).toEqual([]);
    expect(committed).toHaveLength(0);
  });
});
