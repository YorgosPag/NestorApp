/**
 * @fileoverview Τύποι + βοηθοί της σουίτας συμβολαίου — το κοινό έδαφος της σουίτας και των καταλόγων περιπτώσεων
 * (χωριστό αρχείο ώστε οι κατάλογοι να μην εισάγουν τη σουίτα: καμία κυκλική εξάρτηση, CHECK 3.80).
 *
 * @module test-utils/fake-firestore/contract/firestore-contract-kit
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** Όσο από το Admin SDK χρησιμοποιεί το συμβόλαιο — κοινό σχήμα του `Firestore` και του `FakeFirestore`. */
export interface ContractSnapshot {
  readonly id: string;
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
  get(field: string): unknown;
}

export interface ContractQuery {
  where(field: string, op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains', value: unknown): ContractQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ContractQuery;
  limit(n: number): ContractQuery;
  startAfter(snapshot: ContractSnapshot): ContractQuery;
  get(): Promise<{ readonly docs: readonly ContractSnapshot[]; readonly size: number; readonly empty: boolean }>;
  count(): { get(): Promise<{ data(): { count: number } }> };
}

export interface ContractDocRef {
  readonly id: string;
  readonly path: string;
  get(): Promise<ContractSnapshot>;
  create(doc: Record<string, unknown>): Promise<unknown>;
  set(doc: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  update(patch: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
  collection(name: string): ContractCollection;
}

export interface ContractCollection extends ContractQuery {
  doc(id: string): ContractDocRef;
}

export interface ContractBatch {
  create(ref: ContractDocRef, doc: Record<string, unknown>): unknown;
  set(ref: ContractDocRef, doc: Record<string, unknown>, options?: { merge?: boolean }): unknown;
  update(ref: ContractDocRef, patch: Record<string, unknown>): unknown;
  delete(ref: ContractDocRef): unknown;
  commit(): Promise<unknown>;
}

export interface ContractTransaction {
  get(ref: ContractDocRef): Promise<ContractSnapshot>;
  set(ref: ContractDocRef, doc: Record<string, unknown>): unknown;
  create(ref: ContractDocRef, doc: Record<string, unknown>): unknown;
  update(ref: ContractDocRef, patch: Record<string, unknown>): unknown;
}

export interface ContractDb {
  collection(path: string): ContractCollection;
  collectionGroup(name: string): ContractQuery;
  batch(): ContractBatch;
  runTransaction<T>(body: (tx: ContractTransaction) => Promise<T>): Promise<T>;
  getAll(...refs: ContractDocRef[]): Promise<readonly ContractSnapshot[]>;
}

export interface ContractHarness {
  /** Ποια υλοποίηση — εμφανίζεται στο όνομα του `describe`. */
  readonly name: 'fake' | 'emulator';
  db(): ContractDb;
  /** Καθαρή βάση πριν από κάθε ισχυρισμό. */
  reset(): Promise<void>;
}

/** Ένας ισχυρισμός του συμβολαίου. Το `id` είναι το κλειδί του `DECLARED_DEVIATIONS`. */
export interface ContractCase {
  readonly id: string;
  readonly title: string;
  run(db: ContractDb): Promise<void>;
}

/** Κοινά υλικά των περιπτώσεων — ζουν εδώ ώστε οι δύο κατάλογοι να μη γράψουν δεύτερο αντίγραφο. */
export const contractValues = { FieldValue, Timestamp } as const;

export async function seedDocs(db: ContractDb, path: string, docs: Record<string, Record<string, unknown>>): Promise<void> {
  for (const [id, doc] of Object.entries(docs)) await db.collection(path).doc(id).set(doc);
}

export async function idsOf(query: ContractQuery): Promise<string[]> {
  return (await query.get()).docs.map((doc) => doc.id);
}
