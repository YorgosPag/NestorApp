/**
 * Regression guard για το orphan-cleanup false-positive (ADR-683 §mesh-load-missing-file).
 *
 * Το `onStorageFinalize` σβήνει αρχεία που ΚΑΝΕΝΑΣ provider δεν διεκδικεί. Δύο φορές αυτό έσβησε
 * νόμιμα αρχεία δευτερόλεπτα μετά το upload: showcase PDFs (2026-04-17) και imported-mesh `.glb`
 * (2026-07-22). Το κοινό: νέα κλάση αρχείου χωρίς provider. Εδώ κλειδώνεται ότι τα imported meshes
 * διεκδικούνται **με query στο `params.uploadId`** (Ν οντότητες → ΕΝΑ αρχείο, doc-id ≠ fileId).
 */

import { findFileOwner } from '../file-ownership-resolver';

type FakeDoc = { id: string; exists: boolean };

/** Ελάχιστο fake Firestore: δρομολογεί ανά collection είτε σε doc-get είτε σε where-query. */
function fakeDb(opts: {
  docs?: Record<string, boolean>; // `${collection}/${docId}` → exists
  query?: Record<string, string | null>; // `${collection}:${field}=${value}` → matched docId (or null)
}) {
  return {
    collection(collection: string) {
      return {
        doc(docId: string) {
          return {
            async get(): Promise<FakeDoc> {
              return { id: docId, exists: Boolean(opts.docs?.[`${collection}/${docId}`]) };
            },
          };
        },
        where(field: string, _op: string, value: string) {
          return {
            limit() {
              return {
                async get() {
                  const hit = opts.query?.[`${collection}:${field}=${value}`] ?? null;
                  return {
                    empty: hit === null,
                    docs: hit === null ? [] : [{ id: hit }],
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof findFileOwner>[0];
}

describe('findFileOwner — orphan-cleanup ownership resolver', () => {
  it('claims a canonical FILES record by doc-id', async () => {
    const db = fakeDb({ docs: { 'files/file_123': true } });
    const claim = await findFileOwner(db, 'file_123');
    expect(claim).toEqual({ provider: 'files', collection: 'files', docId: 'file_123' });
  });

  it('claims an imported-mesh .glb by QUERY on params.uploadId (doc-id ≠ fileId)', async () => {
    // Η οντότητα έχει δικό της enterprise id, το αρχείο έχει το uploadId — μόνο query τα ενώνει.
    const db = fakeDb({
      query: { 'floorplan_imported_meshes:params.uploadId=imesh_upl_1': 'imesh_entity_9' },
    });
    const claim = await findFileOwner(db, 'imesh_upl_1');
    expect(claim).toEqual({
      provider: 'imported_meshes',
      collection: 'floorplan_imported_meshes',
      docId: 'imesh_entity_9',
    });
  });

  it('returns null when NO provider claims the file (genuine orphan → deletable)', async () => {
    const db = fakeDb({});
    expect(await findFileOwner(db, 'imesh_upl_unclaimed')).toBeNull();
  });
});
