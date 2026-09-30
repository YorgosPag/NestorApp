/**
 * @fileoverview **Η δέσμη εγγραφών**: μαζεύει πράξεις και τις εφαρμόζει **μόνο** στο `commit()` — δέσμη χωρίς commit =
 * καμία εγγραφή, ώστε ένα test να πιάνει τον κώδικα που ξεχνά το `commit`.
 *
 * ⚠️ **Όλα ή τίποτα**: πρώτα **όλοι** οι προέλεγχοι (`create` ⇒ δεν υπάρχει, `update` ⇒ υπάρχει), μετά οι εφαρμογές —
 * ένα fake που έγραφε ένα-ένα θα έκρυβε ακριβώς το «κτίριο χωρίς τη γη του». Το `delete` **δεν** έχει προϋπόθεση:
 * διαγραφή ανύπαρκτου είναι αθόρυβα επιτυχής στο αληθινό (ADR-844 Β6).
 *
 * @module test-utils/fake-firestore/batch
 */

import { grpcError, type FakeStore } from './store';
import type { FakeDocRef } from './refs';
import type { Doc } from './values';

type BatchOp =
  | { readonly kind: 'create'; readonly ref: FakeDocRef; readonly doc: Doc }
  | { readonly kind: 'set'; readonly ref: FakeDocRef; readonly doc: Doc; readonly merge: boolean }
  | { readonly kind: 'update'; readonly ref: FakeDocRef; readonly doc: Doc }
  | { readonly kind: 'delete'; readonly ref: FakeDocRef };

function precheck(op: BatchOp): void {
  if (op.kind === 'create' && op.ref.existsNow()) throw grpcError(6, 'ALREADY_EXISTS', op.ref.path);
  if (op.kind === 'update' && !op.ref.existsNow()) throw grpcError(5, 'NOT_FOUND', op.ref.path);
}

function apply(op: BatchOp): Promise<void> {
  switch (op.kind) {
    case 'create': return op.ref.create(op.doc);
    case 'set': return op.ref.set(op.doc, { merge: op.merge });
    case 'update': return op.ref.update(op.doc);
    default: return op.ref.delete();
  }
}

export class FakeBatch {
  private readonly ops: BatchOp[] = [];

  constructor(private readonly store: FakeStore) {}

  create(ref: FakeDocRef, doc: Doc): FakeBatch {
    this.ops.push({ kind: 'create', ref, doc });
    return this;
  }

  set(ref: FakeDocRef, doc: Doc, options?: { readonly merge?: boolean }): FakeBatch {
    this.ops.push({ kind: 'set', ref, doc, merge: options?.merge === true });
    return this;
  }

  update(ref: FakeDocRef, doc: Doc): FakeBatch {
    this.ops.push({ kind: 'update', ref, doc });
    return this;
  }

  delete(ref: FakeDocRef): FakeBatch {
    this.ops.push({ kind: 'delete', ref });
    return this;
  }

  /** Προέλεγχοι όλων, μετά εφαρμογή **με τη σειρά κλήσης** (όπως το αληθινό), και ένα ακόμη βήμα στον μετρητή. */
  async commit(): Promise<void> {
    const ops = this.ops.splice(0);
    ops.forEach(precheck);
    for (const op of ops) await apply(op);
    this.store.countOnly();
  }
}
