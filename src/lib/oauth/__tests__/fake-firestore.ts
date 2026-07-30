/**
 * Ελάχιστη in-memory Firestore για τα suites OAuth (ADR-738)
 *
 * ⚠️ **Δεν** είναι εξομοιωτής. Υλοποιεί ακριβώς τις πράξεις που κάνει ο κώδικας
 * OAuth: `doc().get()/.set()`, `batch()`, `runTransaction()`, και ισότητες
 * `where()`. Ένα πλήρες fake θα ήταν δεύτερη υλοποίηση Firestore προς
 * συντήρηση· ένα mock ανά τεστ θα έκρυβε τη συμπεριφορά που **ελέγχεται** εδώ
 * (ατομικότητα, merge, ερωτήματα σε πεδία).
 *
 * @module lib/oauth/__tests__/fake-firestore
 */

type DocData = Record<string, unknown>;

interface WhereClause {
  readonly field: string;
  readonly value: unknown;
}

export class FakeFirestore {
  private readonly store = new Map<string, Map<string, DocData>>();

  private bucket(name: string): Map<string, DocData> {
    const existing = this.store.get(name);
    if (existing) return existing;
    const created = new Map<string, DocData>();
    this.store.set(name, created);
    return created;
  }

  /** Ό,τι γράφτηκε — για ισχυρισμούς «δεν αποθηκεύτηκε ποτέ ωμό μυστικό». */
  dump(collectionName: string): ReadonlyMap<string, DocData> {
    return this.bucket(collectionName);
  }

  collection(name: string) {
    const bucket = this.bucket(name);
    const makeDoc = (id: string) => ({
      id,
      get: async () => makeSnapshot(id, bucket.get(id)),
      set: async (data: DocData, options?: { merge?: boolean }) => {
        bucket.set(id, options?.merge ? { ...(bucket.get(id) ?? {}), ...data } : { ...data });
      },
    });

    return {
      doc: makeDoc,
      ...makeQuery(bucket, [], makeDoc),
    };
  }

  batch() {
    const writes: Array<() => void> = [];
    return {
      set: (
        ref: { id: string; set: (data: DocData, options?: { merge?: boolean }) => Promise<void> },
        data: DocData,
        options?: { merge?: boolean },
      ) => {
        writes.push(() => void ref.set(data, options));
      },
      commit: async () => {
        writes.forEach((write) => write());
      },
    };
  }

  /**
   * Εκτελεί τον callback **σειριακά**.
   *
   * Αρκεί για τα tests: ελέγχουμε ότι ο κώδικας *χρησιμοποιεί* συναλλαγή και ότι
   * η λογική μέσα της είναι σωστή. Ο πραγματικός ανταγωνισμός είναι ευθύνη της
   * Firestore, όχι δικού μας fake.
   */
  async runTransaction<T>(
    handler: (tx: {
      get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
      set: (
        ref: { set: (data: DocData, options?: { merge?: boolean }) => Promise<void> },
        data: DocData,
        options?: { merge?: boolean },
      ) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const pending: Array<() => void> = [];
    const result = await handler({
      get: (ref) => ref.get(),
      set: (ref, data, options) => {
        pending.push(() => void ref.set(data, options));
      },
    });
    pending.forEach((write) => write());
    return result;
  }
}

function makeSnapshot(id: string, data: DocData | undefined) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
    get: (field: string) => data?.[field],
    ref: { id },
  };
}

function makeQuery(
  bucket: Map<string, DocData>,
  clauses: readonly WhereClause[],
  makeDoc: (id: string) => { id: string; set: (data: DocData, o?: { merge?: boolean }) => Promise<void> },
) {
  const query = {
    where: (field: string, op: string, value: unknown) => {
      if (op !== '==') throw new Error(`FakeFirestore supports only '==' (got '${op}')`);
      return makeQuery(bucket, [...clauses, { field, value }], makeDoc);
    },
    limit: (count: number) => ({
      ...query,
      get: async () => {
        const all = await query.get();
        const docs = all.docs.slice(0, count);
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    }),
    get: async () => {
      const docs = [...bucket.entries()]
        .filter(([, data]) => clauses.every((clause) => data[clause.field] === clause.value))
        .map(([id, data]) => ({
          id,
          data: () => data,
          get: (field: string) => data[field],
          ref: makeDoc(id),
        }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  };

  return query;
}
