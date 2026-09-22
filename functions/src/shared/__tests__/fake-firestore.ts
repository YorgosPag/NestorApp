/**
 * A Firestore small enough to reason about, and honest about the one thing that matters here:
 * **transactions can lose a race, and must retry.**
 *
 * ## Why this exists at all
 *
 * The idempotency work of ADR-873 Φ1 is *about* concurrency. A mock that applies writes
 * immediately and never conflicts would make every test pass — including the tests for the
 * bugs we are fixing (a 50/50 average that swallows a concurrent update cannot be caught by a
 * fake with no concurrency). So this fake keeps a **version per document**, snapshots the
 * versions a transaction read, and **re-runs the whole transaction** when any of them moved
 * before commit — which is exactly what the real optimistic concurrency does.
 *
 * ⚠️ It is NOT a Firestore emulator and does not try to be: no queries, no indexes, no rules.
 * The emulator suite (`tests/functions-integration/`) is where real Firestore semantics get
 * checked. This is for the semantics of **our** code.
 *
 * 🔴 Lives in `functions/src/shared/__tests__/` and imports nothing from `src/` on purpose:
 * `functions/tsconfig.json` has `include: ["src"]`, so test files are compiled during
 * `predeploy` — a single `@/` import here would break `firebase deploy`.
 *
 * @module functions/shared/__tests__/fake-firestore
 * @enterprise ADR-873 Φάση 1 · βήμα 1.1
 */

import type * as admin from 'firebase-admin';

type DocData = Record<string, unknown>;

interface StoredDoc {
  data: DocData;
  /** Bumped on every write. A transaction that read an older one must start over. */
  version: number;
}

/** gRPC `ALREADY_EXISTS` — the code `create()` rejects with, and the code our code checks. */
export const ALREADY_EXISTS = 6;

export class FakeAlreadyExistsError extends Error {
  readonly code = ALREADY_EXISTS;
  constructor(path: string) {
    super(`Document already exists: ${path}`);
  }
}

export interface FakeDocumentSnapshot {
  readonly exists: boolean;
  data(): DocData | undefined;
}

export interface FakeDocumentReference {
  readonly path: string;
  readonly firestore: FakeFirestore;
  get(): Promise<FakeDocumentSnapshot>;
  create(data: DocData): Promise<void>;
  update(data: DocData): Promise<void>;
  delete(): Promise<void>;
}

/** One buffered write of a transaction, applied only if the transaction commits. */
type PendingWrite =
  | { kind: 'set'; path: string; data: DocData }
  | { kind: 'update'; path: string; data: DocData }
  | { kind: 'delete'; path: string };

export class FakeTransaction {
  private readonly reads = new Map<string, number>();
  private readonly writes: PendingWrite[] = [];

  constructor(private readonly store: FakeFirestore) {}

  async get(ref: FakeDocumentReference): Promise<FakeDocumentSnapshot> {
    const stored = this.store.peek(ref.path);
    // Version 0 means "absent when we looked" — a document created in the meantime moves it to
    // 1 and invalidates this transaction, which is the whole point of recording it.
    this.reads.set(ref.path, stored?.version ?? 0);
    return snapshotOf(stored);
  }

  set(ref: FakeDocumentReference, data: DocData): void {
    this.writes.push({ kind: 'set', path: ref.path, data });
  }

  update(ref: FakeDocumentReference, data: DocData): void {
    this.writes.push({ kind: 'update', path: ref.path, data });
  }

  delete(ref: FakeDocumentReference): void {
    this.writes.push({ kind: 'delete', path: ref.path });
  }

  /** @internal */
  conflicts(): boolean {
    for (const [path, version] of this.reads) {
      if ((this.store.peek(path)?.version ?? 0) !== version) return true;
    }
    return false;
  }

  /** @internal */
  commit(): void {
    for (const write of this.writes) this.store.applyWrite(write);
  }
}

const snapshotOf = (stored: StoredDoc | undefined): FakeDocumentSnapshot => ({
  exists: stored !== undefined,
  data: () => (stored === undefined ? undefined : { ...stored.data }),
});

export class FakeFirestore {
  private readonly docs = new Map<string, StoredDoc>();
  /** Runs right before a transaction checks for conflicts — lets a test interleave a writer. */
  private interleave: (() => void) | null = null;
  transactionAttempts = 0;

  constructor(seed: Record<string, DocData> = {}) {
    for (const [path, data] of Object.entries(seed)) {
      this.docs.set(path, { data: { ...data }, version: 1 });
    }
  }

  collection(name: string): { doc: (id: string) => FakeDocumentReference } {
    return { doc: (id: string) => this.doc(`${name}/${id}`) };
  }

  doc(path: string): FakeDocumentReference {
    const firestore = this;
    return {
      path,
      firestore,
      async get() {
        return snapshotOf(firestore.peek(path));
      },
      async create(data: DocData) {
        if (firestore.peek(path) !== undefined) throw new FakeAlreadyExistsError(path);
        firestore.applyWrite({ kind: 'set', path, data });
      },
      async update(data: DocData) {
        firestore.applyWrite({ kind: 'update', path, data });
      },
      async delete() {
        firestore.applyWrite({ kind: 'delete', path });
      },
    };
  }

  /**
   * Run `work` in a transaction, retrying it when a document it read has moved.
   *
   * The retry is the behaviour under test in "two orders, one material": without it, the second
   * writer would commit on top of a stale read and an update would vanish.
   */
  async runTransaction<T>(work: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      this.transactionAttempts++;
      const transaction = new FakeTransaction(this);
      const result = await work(transaction);
      this.interleave?.();
      if (transaction.conflicts()) continue;
      transaction.commit();
      return result;
    }
    throw new Error('FakeFirestore: transaction exceeded retry budget');
  }

  /** Have `writer` run exactly once, between the next transaction's reads and its commit. */
  interleaveOnce(writer: () => void): void {
    this.interleave = () => {
      this.interleave = null;
      writer();
    };
  }

  /** @internal */
  peek(path: string): StoredDoc | undefined {
    return this.docs.get(path);
  }

  /** @internal */
  applyWrite(write: PendingWrite): void {
    const current = this.docs.get(write.path);
    if (write.kind === 'delete') {
      this.docs.delete(write.path);
      return;
    }
    const data = write.kind === 'set' ? { ...write.data } : { ...current?.data, ...write.data };
    this.docs.set(write.path, { data, version: (current?.version ?? 0) + 1 });
  }

  /** What a document holds right now — for assertions. */
  read(path: string): DocData | undefined {
    const stored = this.docs.get(path);
    return stored === undefined ? undefined : { ...stored.data };
  }

  /** Every path currently stored — for "nothing else was written" assertions. */
  paths(): string[] {
    return [...this.docs.keys()].sort();
  }
}

/**
 * Hand the fake to code typed against the Admin SDK.
 *
 * A structural cast, not `any`: the fake really does implement the surface our writers use
 * (`collection().doc()`, `runTransaction`, `create/update/delete/get`), and a compile error
 * here would mean the fake drifted from that surface — worth knowing.
 */
export const asFirestore = (fake: FakeFirestore): admin.firestore.Firestore =>
  fake as unknown as admin.firestore.Firestore;
