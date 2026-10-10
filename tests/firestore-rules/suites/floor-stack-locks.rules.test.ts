/**
 * Firestore Rules — `floor_stack_locks` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — CHECK 3.102.
 *
 * One document per building, holding a revision counter. Every change to the building's
 * floor stack (floor birth, number/kind/name edit, removal, special-level placement) reads
 * it and bumps it inside its own transaction, which is what serializes two concurrent
 * floor creations — Firestore has no unique constraint, and a query lock inside a
 * transaction does not cover a NEW matching document.
 *
 * Write: a client that bumps the counter forces every in-flight floor change of that
 * building to retry — a denial of service that leaves no trace anywhere else.
 * Read: who touched another building's stack, and when.
 *
 * @since 2026-10-10
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'floor_stack_locks',
)!;

describe('floor_stack_locks.rules — the floor stack lock is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
