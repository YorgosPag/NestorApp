/**
 * @fileoverview Ελάχιστος **πλαστός Firestore** για τις άγκυρες του επιπέδου Α.
 * @related services/places/public-place-write.service.ts
 *
 * ⚠️ **Δεν είναι προσομοίωση του Firestore** και δεν προσποιείται ότι είναι. Υλοποιεί
 * **ακριβώς** τις πράξεις που κάνει ο γραφέας — `doc().get/create/set`,
 * `where().where().limit().get()`, `batch().create().commit()` — ώστε οι άγκυρες να
 * κρίνουν **τη δική μας λογική** (ταυτότητα, κατάταξη, ερώτηση διπλότυπου) χωρίς
 * εξομοιωτή. Ό,τι αφορά **κανόνες πρόσβασης** δοκιμάζεται αλλού, σε **πραγματικό**
 * εξομοιωτή (`tests/firestore-rules/`), γιατί εκεί το ερώτημα είναι άλλο.
 *
 * 🔑 **Το `create()` πετά όταν το έγγραφο υπάρχει** — αυτό είναι το μόνο συμβόλαιο του
 * Firestore από το οποίο εξαρτάται η ορθότητα του γραφέα (N.6: ποτέ γραφή πάνω σε
 * υπάρχουσα ταυτότητα), οπότε ο πλαστός **οφείλει** να το τηρεί.
 */

type Doc = Record<string, unknown>;

interface WhereClause {
  readonly field: string;
  readonly op: '==' | '>=' | '<=';
  readonly value: unknown;
}

/** `a.b.c` → η τιμή, ή `undefined`. */
function readPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node === null || typeof node !== 'object' ? undefined : (node as Doc)[key]),
    doc,
  );
}

function matches(doc: Doc, clause: WhereClause): boolean {
  const value = readPath(doc, clause.field);
  if (clause.op === '==') return value === clause.value;
  if (typeof value !== 'number' || typeof clause.value !== 'number') return false;
  return clause.op === '>=' ? value >= clause.value : value <= clause.value;
}

export class FakeFirestore {
  /** συλλογή → (id → έγγραφο) */
  private readonly store = new Map<string, Map<string, Doc>>();

  /** Πόσες εγγραφές έγιναν — ώστε οι άγκυρες να μετρούν **πράξεις**, όχι μόνο κατάσταση. */
  public writes = 0;

  private bucket(name: string): Map<string, Doc> {
    const existing = this.store.get(name);
    if (existing !== undefined) return existing;
    const created = new Map<string, Doc>();
    this.store.set(name, created);
    return created;
  }

  /** Ό,τι υπάρχει σε μια συλλογή — για τους ισχυρισμούς των άγκυρων. */
  public all<T>(collection: string): readonly T[] {
    return [...this.bucket(collection).values()] as T[];
  }

  public seed(collection: string, id: string, doc: Doc): void {
    this.bucket(collection).set(id, doc);
  }

  public collection(name: string): FakeCollection {
    return new FakeCollection(this, this.bucket(name));
  }

  public batch(): FakeBatch {
    return new FakeBatch(this);
  }

  public countWrite(): void {
    this.writes += 1;
  }
}

export class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    private readonly bucket: Map<string, Doc>,
    public readonly id: string,
  ) {}

  async get(): Promise<{ data: () => Doc | undefined }> {
    const found = this.bucket.get(this.id);
    return { data: () => found };
  }

  async create(doc: Doc): Promise<void> {
    if (this.bucket.has(this.id)) {
      throw new Error(`ALREADY_EXISTS: ${this.id}`);
    }
    this.bucket.set(this.id, doc);
    this.db.countWrite();
  }

  async set(doc: Doc): Promise<void> {
    this.bucket.set(this.id, doc);
    this.db.countWrite();
  }
}

export class FakeQuery {
  constructor(
    private readonly bucket: Map<string, Doc>,
    private readonly clauses: readonly WhereClause[] = [],
    private readonly cap: number = Number.MAX_SAFE_INTEGER,
  ) {}

  where(field: string, op: WhereClause['op'], value: unknown): FakeQuery {
    return new FakeQuery(this.bucket, [...this.clauses, { field, op, value }], this.cap);
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.bucket, this.clauses, n);
  }

  async get(): Promise<{ docs: { data: () => Doc }[]; size: number }> {
    const hits = [...this.bucket.values()]
      .filter((doc) => this.clauses.every((clause) => matches(doc, clause)))
      .slice(0, this.cap);

    return { docs: hits.map((doc) => ({ data: () => doc })), size: hits.length };
  }
}

export class FakeCollection extends FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly docs: Map<string, Doc>,
  ) {
    super(docs);
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, this.docs, id);
  }
}

export class FakeBatch {
  private readonly pending: { ref: FakeDocRef; doc: Doc }[] = [];

  constructor(private readonly db: FakeFirestore) {}

  create(ref: FakeDocRef, doc: Doc): void {
    this.pending.push({ ref, doc });
  }

  async commit(): Promise<void> {
    // ⚠️ **Ατομικότητα**: όλα ή τίποτα. Ο γραφέας βασίζεται σε αυτό ώστε να μη
    // γεννηθεί ποτέ κτίριο χωρίς τη γη του — και ένας πλαστός που έγραφε ένα-ένα θα
    // έκρυβε ακριβώς αυτό το σφάλμα.
    for (const { ref } of this.pending) {
      const snapshot = await ref.get();
      if (snapshot.data() !== undefined) throw new Error(`ALREADY_EXISTS: ${ref.id}`);
    }
    for (const { ref, doc } of this.pending) await ref.create(doc);
    this.db.countWrite();
  }
}
