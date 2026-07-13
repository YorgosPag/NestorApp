/**
 * Firestore Rules Test Harness — Matrix-Driven Assertions
 *
 * Every matrix cell from a coverage manifest entry is executed through
 * `assertCell`. The helper dispatches to the correct read/list/create/
 * update/delete operation and wraps the Firestore call in `assertSucceeds`
 * or `assertFails` based on the declared outcome.
 *
 * See ADR-298 §3.3 (test file contract).
 *
 * @module tests/firestore-rules/_harness/assertions
 * @since 2026-04-11 (ADR-298 Phase A)
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';

import type { Operation } from '../_registry/operations';
import type { CoverageCell } from '../_registry/coverage-manifest';

/** Shape of the document a test is asserting against. */
export interface AssertTarget {
  /** Physical collection name (matches manifest + firestore.rules). */
  readonly collection: string;
  /** Document id to read/update/delete — also used as the base for create ids. */
  readonly docId: string;
  /** Payload for update. Also used as create fallback when `createData` is omitted. */
  readonly data?: Record<string, unknown>;
  /**
   * Payload for create operations. Keep separate from `data` because create
   * rules often require a distinct shape (e.g. `status: 'pending'` on files,
   * or `resource == null` gates that mandate full valid-document payloads).
   */
  readonly createData?: Record<string, unknown>;
  /**
   * For list operations: the `where` filter(s) applied to the query.
   *
   * A list rule is evaluated against the **query**, not against the stored
   * documents: any field the rule reads (`resource.data.x`) that the query
   * does not constrain evaluates to `undefined` and the query is rejected —
   * "rules are not filters". So a list test must send the *same* query the
   * production client sends. Collections whose rule reads more than one field
   * (e.g. `block_library`: scope + createdBy + companyId — the scope buckets
   * of `ScopedLibraryService`) therefore need several filters, hence the
   * array form. A single filter object stays valid for the simple case.
   */
  readonly listFilter?: ListFilter | readonly ListFilter[];
}

/** One `where(field, op, value)` clause of a list query. */
export interface ListFilter {
  readonly field: string;
  readonly op: FirebaseFirestore.WhereFilterOp;
  readonly value: unknown;
}

/**
 * Execute a matrix cell against a Firestore context.
 *
 * The function owns the mapping from `Operation` → Firestore client call
 * and from `Outcome` → `assertSucceeds`/`assertFails`. Test files only
 * declare the matrix; the harness owns execution.
 */
export async function assertCell(
  ctx: RulesTestContext,
  cell: CoverageCell,
  target: AssertTarget,
): Promise<void> {
  const promise = executeOperation(ctx, cell.operation, target);
  if (cell.outcome === 'allow') {
    await assertSucceeds(promise);
  } else {
    await assertFails(promise);
  }
}

/** Normalize the single-filter and multi-filter forms into one list. */
function toListFilters(
  filter: ListFilter | readonly ListFilter[] | undefined,
): readonly ListFilter[] {
  if (!filter) return [];
  return Array.isArray(filter) ? filter : [filter as ListFilter];
}

function executeOperation(
  ctx: RulesTestContext,
  op: Operation,
  target: AssertTarget,
): Promise<unknown> {
  const db = ctx.firestore();
  const docRef = db.collection(target.collection).doc(target.docId);

  switch (op) {
    case 'read':
      return docRef.get();
    case 'list': {
      let query: FirebaseFirestore.Query = db.collection(target.collection);
      for (const filter of toListFilters(target.listFilter)) {
        query = query.where(filter.field, filter.op, filter.value);
      }
      return query.get();
    }
    case 'create': {
      // Fresh doc id — tests seed a same-tenant fixture at `target.docId`,
      // so calling `.set()` there would hit the UPDATE rule path (resource
      // already exists). CREATE must target a non-existent id to exercise
      // the real `resource == null` gate.
      const createId = `${target.docId}-create-${Date.now().toString(36)}`;
      const createRef = db.collection(target.collection).doc(createId);
      return createRef.set(target.createData ?? target.data ?? { placeholder: true });
    }
    case 'update':
      return docRef.update(target.data ?? { touchedAt: new Date() });
    case 'delete':
      return docRef.delete();
    default: {
      const never: never = op;
      throw new Error(`assertCell: unhandled operation ${String(never)}`);
    }
  }
}

/**
 * Convenience wrapper used by rule-shape regression tests that need to
 * assert directly without going through a matrix cell.
 */
export async function expectAllow(promise: Promise<unknown>): Promise<void> {
  await assertSucceeds(promise);
}

export async function expectDeny(promise: Promise<unknown>): Promise<void> {
  await assertFails(promise);
}
