/**
 * IN-MEMORY FIRESTORE MOCK — Google-level deterministic testing
 *
 * Replaces `getAdminFirestore()` with a fully in-memory data store.
 * Supports: `collection().doc().get/set/update/delete`, `where().limit().get()`,
 * `count().get()`, `runTransaction(tx => …)` (σειριακό — βλ. `MockTransaction`),
 * `batch()` (αναβαλλόμενο ως το `commit` — βλ. `MockWriteBatch`).
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

/** Διαδρομή πεδίου με τελείες (`tileset.state`) — όπως ο Firestore, όχι σκέτο κλειδί. */
function readFieldPath(data: DocData, field: string): unknown {
  return field.split('.').reduce<unknown>(
    (value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
    data,
  );
}

class MockQuery {
  private clauses: WhereClause[] = [];
  private _limit = 100;
  private _orderByField: string | null = null;
  /** Δρομέας σελιδοποίησης — η σειρά είναι η σειρά εισαγωγής (ο mock δεν ταξινομεί). */
  private _startAfterId: string | null = null;

  constructor(
    protected store: Store,
    protected collectionName: string,
    protected journal: MockWriteRecord[],
  ) {}

  static group(store: Store, name: string, journal: MockWriteRecord[]): MockQuery {
    const q = new MockQuery(store, name, journal);
    q.group = true;
    return q;
  }

  where(field: string, op: string, value: unknown): MockQuery {
    const q = this.clone();
    q.clauses.push({ field, op, value });
    return q;
  }

  /** Η κατεύθυνση γίνεται δεκτή (υπογραφή Admin SDK) — ο mock **δεν** ταξινομεί. */
  orderBy(field: string, _direction?: 'asc' | 'desc'): MockQuery {
    const q = this.clone();
    q._orderByField = field;
    return q;
  }

  limit(n: number): MockQuery {
    const q = this.clone();
    q._limit = n;
    return q;
  }

  /** Σελιδοποίηση με δρομέα-έγγραφο (υπογραφή Admin SDK). */
  startAfter(snap: { readonly id: string }): MockQuery {
    const q = this.clone();
    q._startAfterId = snap.id;
    return q;
  }

  /** `true` ⇒ ερώτημα **collectionGroup**: κάθε συλλογή με αυτό το τελικό όνομα, κάτω από οποιονδήποτε γονέα. */
  protected group = false;

  /** Οι εγγραφές που βλέπει το ερώτημα — `[συλλογή, id, δεδομένα]`, ώστε κάθε `ref` να κρατά τη **δική του** διαδρομή. */
  private scannedEntries(): Array<[string, string, DocData]> {
    const collections = this.group
      ? [...this.store.keys()].filter((key) => key === this.collectionName || key.endsWith(`/${this.collectionName}`))
      : [this.collectionName];
    return collections.flatMap((name) =>
      [...(this.store.get(name) ?? new Map<string, DocData>()).entries()].map(([id, data]): [string, string, DocData] => [name, id, data]));
  }

  async get(): Promise<{ docs: MockDocSnap[]; empty: boolean; size: number }> {
    let entries = this.scannedEntries();

    // Apply filters
    for (const clause of this.clauses) {
      entries = entries.filter(([, id, data]) => {
        const fieldValue = clause.field === 'id' ? id : readFieldPath(data, clause.field);
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

    // Cursor
    if (this._startAfterId !== null) {
      const at = entries.findIndex(([, id]) => id === this._startAfterId);
      entries = at === -1 ? [] : entries.slice(at + 1);
    }

    // Limit
    entries = entries.slice(0, this._limit);

    const docs = entries.map(
      ([name, id, data]) => new MockDocSnap(id, data, true, name, this.store, this.journal),
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
    q._startAfterId = this._startAfterId;
    q.group = this.group;
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

  /** Η πλήρης διαδρομή — όπως `DocumentReference.path`. */
  get path(): string {
    return `${this.collectionName}/${this.docId}`;
  }

  /** Σύγχρονη ερώτηση ύπαρξης — για το `create` της σειριακής συναλλαγής (όχι API του Firestore). */
  exists(): boolean {
    return this.store.get(this.collectionName)?.has(this.docId) ?? false;
  }

  /**
   * **Υποσυλλογή** — κλειδί αποθήκευσης η πλήρης διαδρομή (`γονέας/id/όνομα`), όπως στον Firestore:
   * ίδιο όνομα κάτω από άλλον γονέα είναι **άλλη** συλλογή (ADR-884 Κ2 — οι λήψεις ζουν κάτω από
   * δύο διαμερίσματα). Το `seedCollection`/`getAllDocs` δέχονται την ίδια διαδρομή.
   */
  collection(name: string): MockCollectionRef {
    return new MockCollectionRef(this.store, `${this.collectionName}/${this.docId}/${name}`, this.journal);
  }

  /** Η συλλογή του εγγράφου — όπως `DocumentReference.parent` (ADR-884 Κ2β: άδεια δίπλα στην πρόσκληση). */
  get parent(): MockCollectionRef {
    return new MockCollectionRef(this.store, this.collectionName, this.journal);
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

  /**
   * **Δημιουργία που αποτυγχάνει αν υπάρχει** — όπως `DocumentReference.create` (ALREADY_EXISTS). Ο κώδικας
   * «γέννα αν λείπει» (ADR-884 Κ3α) στηρίζεται ακριβώς σε αυτή τη διάκριση· ένα `set` θα σκέπαζε το υπάρχον.
   * Στο ημερολόγιο γράφεται ως `set` — η διάκριση ζει στη ρίψη, όχι στο είδος της εγγραφής.
   */
  async create(data: DocData): Promise<void> {
    if (this.store.get(this.collectionName)?.has(this.docId)) {
      throw new Error(`ALREADY_EXISTS: ${this.collectionName}/${this.docId}`);
    }
    await this.set(data);
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

  /**
   * Το έγγραφο-γονέας μιας **υποσυλλογής** (`γονέας/id/όνομα`) — `null` για κορυφαία συλλογή, όπως
   * `CollectionReference.parent` στον Firestore.
   */
  get parent(): MockDocRef | null {
    const parts = this.collectionName.split('/');
    if (parts.length < 3) return null;
    return new MockDocRef(this.store, parts.slice(0, -2).join('/'), parts[parts.length - 2] ?? '', this.journal);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * **Σειριακή** συναλλαγή: `get` διαβάζει, `update`/`set` γράφουν αμέσως (και μπαίνουν στο
 * ημερολόγιο). Αρκεί για τη **λογική** μιας συναλλαγής (τι κρίνει πάνω στο ανάγνωσμα, τι
 * γράφει)· **δεν** προσομοιώνει ανταγωνισμό — αυτό το εγγυάται ο Firestore, όχι ο κώδικας μας.
 */
class MockTransaction {
  get(ref: MockDocRef): Promise<MockDocSnap> {
    return ref.get();
  }

  update(ref: MockDocRef, data: DocData): MockTransaction {
    void ref.update(data);
    return this;
  }

  set(ref: MockDocRef, data: DocData, options?: { merge?: boolean }): MockTransaction {
    void ref.set(data, options);
    return this;
  }

  /** Σύγχρονη ρίψη, ώστε το `ALREADY_EXISTS` να απορρίπτει τη συναλλαγή όπως στον Firestore. */
  create(ref: MockDocRef, data: DocData): MockTransaction {
    if (ref.exists()) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
    void ref.set(data);
    return this;
  }
}

/**
 * **Αναβαλλόμενη** παρτίδα: οι εγγραφές μαζεύονται και εφαρμόζονται **μόνο** στο `commit()` —
 * ίδια σημασιολογία με τον Firestore (παρτίδα χωρίς `commit` = καμία εγγραφή), ώστε ένα test να
 * μπορεί να πιάσει τον κώδικα που ξεχνά το `commit`.
 */
class MockWriteBatch {
  private readonly ops: Array<() => Promise<void>> = [];

  update(ref: MockDocRef, data: DocData): MockWriteBatch {
    this.ops.push(() => ref.update(data));
    return this;
  }

  set(ref: MockDocRef, data: DocData, options?: { merge?: boolean }): MockWriteBatch {
    this.ops.push(() => ref.set(data, options));
    return this;
  }

  delete(ref: MockDocRef): MockWriteBatch {
    this.ops.push(() => ref.delete());
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops.splice(0)) await op();
  }
}

export interface MockFirestoreInstance {
  collection(name: string): MockCollectionRef;
  collectionGroup(name: string): MockQuery;
  runTransaction<T>(fn: (tx: MockTransaction) => Promise<T>): Promise<T>;
  batch(): MockWriteBatch;
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

    /** Όπως `Firestore.collectionGroup` — κάθε υποσυλλογή με αυτό το όνομα (ADR-884 Κ3α: «οι λήψεις μου»). */
    collectionGroup(name: string): MockQuery {
      return MockQuery.group(store, name, journal);
    },

    runTransaction<T>(fn: (tx: MockTransaction) => Promise<T>): Promise<T> {
      return fn(new MockTransaction());
    },

    batch(): MockWriteBatch {
      return new MockWriteBatch();
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
