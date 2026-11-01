/**
 * Ελάχιστη Firestore δύο χώρων για tests που εκτελούν τις πραγματικές διαδρομές κτιρίων και ορόφων (ADR-829 §7.1).
 *
 * Τα `where` φιλτράρουν πραγματικά: ερώτημα χωρίς φίλτρο εταιρείας γυρίζει και ξένα έγγραφα, όπως η αληθινή βάση.
 * Ένας διπλός που απαντά πάντα κενό θα έκρυβε ακριβώς τη διαρροή που ψάχνουν αυτά τα tests.
 */

type FakeDocument = Record<string, unknown>;
export type TenantDocuments = Record<string, Record<string, FakeDocument>>;

interface Filter {
  readonly field: string;
  readonly operator: string;
  readonly value: unknown;
}

const state: { documents: TenantDocuments; writes: unknown[] } = { documents: {}, writes: [] };

/** Καθαρή αρχή για κάθε test· οι εγγραφές μηδενίζονται μαζί με τα έγγραφα. */
export function seedTenantDocuments(documents: TenantDocuments): void {
  state.documents = documents;
  state.writes = [];
}

/** Ό,τι πέρασε από `tx.update` στην τρέχουσα εκτέλεση. */
export function tenantWrites(): readonly unknown[] {
  return state.writes;
}

function documentSnapshot(collection: string, id: string) {
  const data = state.documents[collection]?.[id];
  return { id, exists: data !== undefined, data: () => data, ref: { path: `${collection}/${id}` } };
}

function matches(document: FakeDocument, { field, operator, value }: Filter): boolean {
  if (operator === 'in') return Array.isArray(value) && value.includes(document[field]);
  if (operator === '==') return document[field] === value;
  throw new Error(`Τελεστής χωρίς διπλό: ${operator}`);
}

function fakeQuery(collection: string, filters: readonly Filter[]) {
  const query = {
    where: (field: string, operator: string, value: unknown) =>
      fakeQuery(collection, [...filters, { field, operator, value }]),
    limit: () => query,
    select: () => query,
    get: async () => {
      const docs = Object.keys(state.documents[collection] ?? {})
        .map((id) => documentSnapshot(collection, id))
        .filter((snapshot) => filters.every((filter) => matches(snapshot.data() ?? {}, filter)));
      return { empty: docs.length === 0, docs };
    },
  };
  return query;
}

/** Ο διπλός που επιστρέφουν τα `getAdminFirestore` · `requireAdminFirestore` στα tests. */
export function tenantFakeDb() {
  return {
    collection: (collection: string) => ({
      ...fakeQuery(collection, []),
      doc: (id: string) => ({ __path: [collection, id] as const, get: async () => documentSnapshot(collection, id) }),
    }),
    runTransaction: async (run: (transaction: unknown) => Promise<void>) => run({
      get: async (ref: { __path: readonly [string, string] }) => documentSnapshot(...ref.__path),
      update: (_ref: unknown, value: unknown) => { state.writes.push(value); },
    }),
  };
}
