/**
 * Firestore Rules — `idempotency_records` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-853 Ε3 Φάση 2.
 *
 * One document per (principal, method, path, `Idempotency-Key`): the lock while an
 * operation runs, the stored response afterwards. Both halves are dangerous in a
 * client's hands.
 *
 * Read: the stored response of ANOTHER person's operation — it can carry personal data.
 * Write: a forged `completed` record makes a real retry answer «already done» without
 * running; a forged `in-flight` record locks an operation until the lease runs out.
 *
 * @since 2026-09-22 (ADR-853 Ε3 Φάση 2)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'idempotency_records',
)!;

describe('idempotency_records.rules — the idempotency memory is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
