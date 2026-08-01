/**
 * IN-MEMORY FIRESTORE MOCK — Google-level deterministic testing
 *
 * Replaces `getAdminFirestore()` with a fully in-memory data store.
 * Supports: `collection().doc().get/set/update/delete`, `where().limit().get()`,
 * `count().get()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ `ai-pipeline` (μετακίνηση 2026-08-01, ADR-742)
 * ─────────────────────────────────────────────────────────────────────────────
 * Γεννήθηκε στο `src/services/ai-pipeline/tools/__tests__/test-utils/` και ήταν
 * **γενικό εργαλείο σε ιδιωτική διεύθυνση**. Όταν η κάλυψη των σημείων
 * ιδιοκτησίας χρειάστηκε τον ίδιο mock **έξω** από το ai-pipeline, οι δύο
 * επιλογές ήταν «import από ξένο `__tests__`» ή «γράψε δεύτερο mock». Και οι
 * δύο είναι λάθος — η δεύτερη είναι ακριβώς το σχήμα που φυλάει ο N.18.
 * Μετακινήθηκε **ολόκληρο** (όχι αντίγραφο, όχι shim) και ενημερώθηκαν οι 12
 * καλούντες.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΕΓΓΡΑΦΩΝ — γιατί δεν αρκεί το «τι επέστρεψε»
 * ─────────────────────────────────────────────────────────────────────────────
 * Μια διαδρομή που επιστρέφει `Promise<void>` δίνει **πάντα** `toBeFalsy()`.
 * Αν ο φύλακας ιδιοκτησίας της σπάσει, το test μένει πράσινο ενώ το έγγραφο
 * **γράφτηκε**. Η μόνη παρατηρήσιμη διαφορά είναι η **παρενέργεια**, γι' αυτό ο
 * mock κρατά ημερολόγιο κάθε `set`/`update`/`delete` (ADR-742 §7duodecies).
 *
 * @module test-utils/mock-firestore
 * @see adrs/ADR-742 §7terdecies
 */

type DocData = Record<string, unknown>;
type Store = Map<string, Map<string, DocData>>;

/** Μια εγγραφή που όντως έφτασε στη «βάση». */
export interface MockWriteRecord {
  readonly kind: 'set' | 'update' | 'delete';
  readonly collection: string;
  readonly docId: string;
  readonly data?: DocData;
}

// ============================================================================
// QUERY BUILDER (chainable)
// ============================================================================

interface WhereClause {
  field: string;
  op: string;
  value: unknown;
}

class MockQuery {
  private clauses: WhereClause[] = [];
  private _limit = 100;
  private _orderByField: string | null = null;

  constructor(
    protected store: Store,
    protected collectionName: string,
    protected journal: MockWriteRecord[],
  ) {}

  where(field: string, op: string, value: unknown): MockQuery {
    const q = this.clone();
    q.clauses.push({ field, op, value });
    return q;
  }

  orderBy(field: string): MockQuery {
    const q = this.clone();
    q._orderByField = field;
    return q;
  }

  limit(n: number): MockQuery {
    const q = this.clone();
    q._limit = n;
    return q;
  }

  async get(): Promise<{ docs: MockDocSnap[]; empty: boolean; size: number }> {
    const col = this.store.get(this.collectionName) ?? new Map<string, DocData>();
    let entries = [...col.entries()];

    // Apply filters
    for (const clause of this.clauses) {
      entries = entries.filter(([id, data]) => {
        const fieldValue = clause.field === 'id' ? id : data[clause.field];
        switch (clause.op) {
          case '==': return fieldValue === clause.value;
          case '!=': return fieldValue !== clause.value;
          case '<': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue < clause.value;
          case '<=': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue <= clause.value;
          case '>': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue > clause.value;
          case '>=': return typeof fieldValue === 'number' && typeof clause.value === 'number' && fieldValue >= clause.value;
          case 'in': return Array.isArray(clause.value) && clause.value.includes(fieldValue);
          case 'array-contains': return Array.isArray(fieldValue) && fieldValue.includes(clause.value);
          default: return true;
        }
      });
    }

    // Limit
    entries = entries.slice(0, this._limit);

    const docs = entries.map(
      ([id, data]) => new MockDocSnap(id, data, true, this.collectionName, this.store, this.journal),
    );
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  count(): { get: () => Promise<{ data: () => { count: number } }> } {
    return {
      get: async () => {
        const result = await this.get();
        return { data: () => ({ count: result.size }) };
      },
    };
  }

  private clone(): MockQuery {
    const q = new MockQuery(this.store, this.collectionName, this.journal);
    q.clauses = [...this.clauses];
    q._limit = this._limit;
    q._orderByField = this._orderByField;
    return q;
  }
}

// ============================================================================
// DOCUMENT SNAPSHOT
// ============================================================================

class MockDocSnap {
  constructor(
    public readonly id: string,
    private _data: DocData | null,
    public readonly exists: boolean,
    private readonly _collectionName: string,
    private readonly _store: Store,
    private readonly _journal: MockWriteRecord[],
  ) {}

  data(): DocData | undefined {
    return this._data ?? undefined;
  }

  /**
   * Ο κώδικας παραγωγής γράφει `snap.ref.delete()` / `snap.ref.update(...)`.
   * Χωρίς αυτό, ο mock αναγκάζει τη διαδρομή να παρακάμψει το `ref` — δηλαδή
   * να **μη δοκιμαστεί** η ίδια η παρενέργεια που ελέγχουμε.
   */
  get ref(): MockDocRef {
    return new MockDocRef(this._store, this._collectionName, this.id, this._journal);
  }
}

// ============================================================================
// DOCUMENT REFERENCE
// ============================================================================

class MockDocRef {
  constructor(
    private store: Store,
    private collectionName: string,
    private docId: string,
    private journal: MockWriteRecord[],
  ) {}

  get id(): string {
    return this.docId;
  }

  async get(): Promise<MockDocSnap> {
    const col = this.store.get(this.collectionName);
    const data = col?.get(this.docId) ?? null;
    return new MockDocSnap(
      this.docId,
      data,
      data !== null,
      this.collectionName,
      this.store,
      this.journal,
    );
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    if (!this.store.has(this.collectionName)) {
      this.store.set(this.collectionName, new Map());
    }
    const col = this.store.get(this.collectionName)!;
    if (options?.merge) {
      const existing = col.get(this.docId) ?? {};
      col.set(this.docId, { ...existing, ...data });
    } else {
      col.set(this.docId, { ...data });
    }
    this.journal.push({ kind: 'set', collection: this.collectionName, docId: this.docId, data });
  }

  async update(data: DocData): Promise<void> {
    const col = this.store.get(this.collectionName);
    const existing = col?.get(this.docId);
    if (!existing) {
      throw new Error(`Document ${this.collectionName}/${this.docId} not found`);
    }
    col!.set(this.docId, { ...existing, ...data });
    this.journal.push({ kind: 'update', collection: this.collectionName, docId: this.docId, data });
  }

  async delete(): Promise<void> {
    this.store.get(this.collectionName)?.delete(this.docId);
    this.journal.push({ kind: 'delete', collection: this.collectionName, docId: this.docId });
  }
}

// ============================================================================
// COLLECTION REFERENCE (extends MockQuery for chainable where/limit)
// ============================================================================

class MockCollectionRef extends MockQuery {
  doc(id: string): MockDocRef {
    return new MockDocRef(this.store, this.collectionName, id, this.journal);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export interface MockFirestoreInstance {
  collection(name: string): MockCollectionRef;
}

export interface MockFirestoreKit {
  instance: MockFirestoreInstance;
  seedCollection(name: string, docs: Record<string, DocData>): void;
  getData(collection: string, docId: string): DocData | undefined;
  getAllDocs(collection: string): Record<string, DocData>;
  /**
   * Κάθε `set`/`update`/`delete` που έφτασε στη «βάση», με σειρά.
   * **Μη κενό ημερολόγιο σε διαδρομή που όφειλε να αρνηθεί = διαρροή.**
   */
  writes(): readonly MockWriteRecord[];
  /** Μηδενίζει το ημερολόγιο χωρίς να πειράξει τα δεδομένα (setup vs act). */
  clearWrites(): void;
}

export function createMockFirestore(): MockFirestoreKit {
  const store: Store = new Map();
  const journal: MockWriteRecord[] = [];

  const instance: MockFirestoreInstance = {
    collection(name: string): MockCollectionRef {
      return new MockCollectionRef(store, name, journal);
    },

  };

  return {
    instance,

    seedCollection(name: string, docs: Record<string, DocData>): void {
      const col = new Map<string, DocData>();
      for (const [id, data] of Object.entries(docs)) {
        col.set(id, { ...data });
      }
      store.set(name, col);
    },

    getData(collection: string, docId: string): DocData | undefined {
      return store.get(collection)?.get(docId);
    },

    getAllDocs(collection: string): Record<string, DocData> {
      const col = store.get(collection);
      if (!col) return {};
      const result: Record<string, DocData> = {};
      for (const [id, data] of col) result[id] = data;
      return result;
    },

    writes(): readonly MockWriteRecord[] {
      return journal;
    },

    clearWrites(): void {
      journal.length = 0;
    },
  };
}
