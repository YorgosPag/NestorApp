/**
 * @fileoverview **Αναφορές** του ψεύτικου Firestore — έγγραφο, ερώτημα, συλλογή — με το σχήμα του Admin SDK.
 *
 * Κάθε ιδιότητα εδώ υπάρχει επειδή ο κώδικας παραγωγής τη διαβάζει: `snapshot.id` (ανασύνθεση `{...data(), id}`,
 * §8.34), `exists` ως **ιδιότητα** (όχι μέθοδος, όπως ο πελάτης), `snap.ref` (ο κώδικας γράφει `snap.ref.update(…)` —
 * χωρίς αυτό η παρενέργεια δεν θα δοκιμαζόταν), `ref.path`/`parent`/`collection()` (υποσυλλογές, ADR-884 Κ2).
 *
 * @module test-utils/fake-firestore/refs
 */

import { assertReadable, grpcError, type FakeContext } from './store';
import { EMPTY_SPEC, runQuery, type QuerySpec, type ScannedDoc } from './query-engine';
import { applyFieldPatch, applyIncrements, mergeDoc, readPath, type Doc, type WhereOp } from './values';

export interface FakeDocSnapshot {
  readonly id: string;
  readonly exists: boolean;
  readonly ref: FakeDocRef;
  data(): Doc | undefined;
  get(field: string): unknown;
}

/** Στιγμιότυπο αποτελέσματος ερωτήματος — υπάρχει πάντα, άρα `data()` ποτέ `undefined` (όπως `QueryDocumentSnapshot`). */
export interface FakeQueryDocSnapshot extends FakeDocSnapshot {
  data(): Doc;
}

export interface FakeQuerySnapshot {
  readonly docs: FakeQueryDocSnapshot[];
  readonly size: number;
  readonly empty: boolean;
  forEach(callback: (doc: FakeQueryDocSnapshot) => void): void;
}

function snapshotOf(ref: FakeDocRef, data: Doc | undefined): FakeDocSnapshot {
  return { id: ref.id, exists: data !== undefined, ref, data: () => data, get: (field) => (data === undefined ? undefined : readPath(data, field)) };
}

export class FakeDocRef {
  constructor(
    private readonly ctx: FakeContext,
    /** Διαδρομή της **συλλογής** — σταθερό κλειδί για ό,τι θυμάται η συναλλαγή. */
    public readonly collectionName: string,
    public readonly id: string,
  ) {}

  get path(): string {
    return `${this.collectionName}/${this.id}`;
  }

  get parent(): FakeCollection {
    return new FakeCollection(this.ctx, this.collectionName);
  }

  /** Υποσυλλογή — ίδιο όνομα κάτω από άλλον γονέα είναι **άλλη** συλλογή (ADR-862 Φ0 Β7). */
  collection(name: string): FakeCollection {
    return new FakeCollection(this.ctx, `${this.path}/${name}`);
  }

  private get bucket(): Map<string, Doc> {
    return this.ctx.store.bucket(this.collectionName);
  }

  async get(): Promise<FakeDocSnapshot> {
    assertReadable(this.ctx);
    return snapshotOf(this, this.bucket.get(this.id));
  }

  /** Σύγχρονη ερώτηση ύπαρξης — για τους προελέγχους δέσμης/συναλλαγής (δεν είναι API του Firestore). */
  existsNow(): boolean {
    return this.bucket.has(this.id);
  }

  /** **Αποτυγχάνει αν υπάρχει** (`ALREADY_EXISTS`, gRPC 6) — ο κώδικας «γέννα αν λείπει» στηρίζεται σε αυτό (N.6). */
  async create(doc: Doc): Promise<void> {
    if (this.existsNow()) throw grpcError(6, 'ALREADY_EXISTS', this.path);
    this.bucket.set(this.id, applyIncrements({}, doc));
    this.ctx.store.record({ kind: 'set', collection: this.collectionName, docId: this.id, data: doc });
  }

  /**
   * `set` — με `{ merge: true }` **συγχωνεύει** αντί να αντικαθιστά (ADR-827 §9.20: χωρίς αυτό ένας γραφέας που ξεχνά
   * το merge θα έσβηνε όλο το προφίλ και κανένα test δεν θα το έβλεπε). Η συγχώνευση είναι **βαθιά**, όπως στο
   * αληθινό — βλ. {@link mergeDoc}.
   */
  async set(doc: Doc, options?: { readonly merge?: boolean }): Promise<void> {
    const existing = this.bucket.get(this.id) ?? {};
    const next = options?.merge === true ? mergeDoc(existing, doc) : applyIncrements({}, doc);
    this.bucket.set(this.id, next);
    this.ctx.store.record({ kind: 'set', collection: this.collectionName, docId: this.id, data: doc });
  }

  /** Διαδρομές πεδίων, `FieldValue.delete/increment`· **πετά `NOT_FOUND`** (gRPC 5) αν λείπει — ποτέ σιωπηλή δημιουργία. */
  async update(patch: Doc): Promise<void> {
    const current = this.bucket.get(this.id);
    if (current === undefined) throw grpcError(5, 'NOT_FOUND', this.path);
    this.bucket.set(this.id, applyFieldPatch(current, patch));
    this.ctx.store.record({ kind: 'update', collection: this.collectionName, docId: this.id, data: patch });
  }

  /** Idempotent, όπως το SDK: σβήσιμο ανύπαρκτου εγγράφου δεν είναι λάθος. */
  async delete(): Promise<void> {
    this.bucket.delete(this.id);
    this.ctx.store.record({ kind: 'delete', collection: this.collectionName, docId: this.id });
  }
}

export class FakeQuery {
  constructor(
    protected readonly ctx: FakeContext,
    /** Διαδρομή συλλογής — ή, για `collectionGroup`, το τελικό όνομα. */
    public readonly collectionName: string,
    private readonly spec: QuerySpec = EMPTY_SPEC,
    private readonly group = false,
  ) {}

  private with(patch: Partial<QuerySpec>): FakeQuery {
    return new FakeQuery(this.ctx, this.collectionName, { ...this.spec, ...patch }, this.group);
  }

  where(field: string, op: WhereOp, value: unknown): FakeQuery {
    return this.with({ clauses: [...this.spec.clauses, { field, op, value }] });
  }

  /** Ένα `orderBy` ανά ερώτημα (όσο χρειάζονται οι καλούντες)· προεπιλογή αύξουσα. */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): FakeQuery {
    return this.with({ order: { field, direction } });
  }

  limit(n: number): FakeQuery {
    return this.with({ cap: n });
  }

  /** Σελιδοποίηση με δρομέα-έγγραφο (υπογραφή Admin SDK). */
  startAfter(snapshot: { readonly id: string; data?: () => Doc | undefined }): FakeQuery {
    return this.with({ after: { id: snapshot.id, data: snapshot.data?.() } });
  }

  private scan(): ScannedDoc[] {
    const paths = this.group ? this.ctx.store.groupPaths(this.collectionName) : [this.collectionName];
    return paths.flatMap((path) => [...this.ctx.store.bucket(path).entries()].map(([id, data]) => ({ path, id, data })));
  }

  async get(): Promise<FakeQuerySnapshot> {
    assertReadable(this.ctx);
    const docs = runQuery(this.scan(), this.spec).map((row) => {
      const ref = new FakeDocRef(this.ctx, row.path, row.id);
      return { ...snapshotOf(ref, row.data), data: () => row.data };
    });
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (callback) => docs.forEach(callback) };
  }

  /** `query.count().get()` — μετρά ό,τι θα επέστρεφε το ερώτημα, **με** το `limit` του (ADR-890 Φ1). */
  count(): { get: () => Promise<{ data: () => { count: number } }> } {
    return {
      get: async () => {
        const { size } = await this.get();
        return { data: () => ({ count: size }) };
      },
    };
  }

  static group(ctx: FakeContext, name: string): FakeQuery {
    return new FakeQuery(ctx, name, EMPTY_SPEC, true);
  }
}

export class FakeCollection extends FakeQuery {
  constructor(ctx: FakeContext, path: string) {
    super(ctx, path);
  }

  get id(): string {
    return this.collectionName.slice(this.collectionName.lastIndexOf('/') + 1);
  }

  get path(): string {
    return this.collectionName;
  }

  /** Το έγγραφο-γονέας μιας **υποσυλλογής** — `null` για κορυφαία συλλογή, όπως `CollectionReference.parent`. */
  get parent(): FakeDocRef | null {
    const parts = this.collectionName.split('/');
    if (parts.length < 3) return null;
    return new FakeDocRef(this.ctx, parts.slice(0, -2).join('/'), parts[parts.length - 2] ?? '');
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.ctx, this.collectionName, id);
  }
}
