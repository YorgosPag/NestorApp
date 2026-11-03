/**
 * Firestore Rules — `supplier_verifications` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-923 §5.13 Ε1α.
 *
 * Holds one document per workspace: the manual review of a supplier, with a keyed tax fingerprint.
 *
 * WRITES are the danger that matters: a client that could write here could approve ITSELF as a verified supplier.
 *
 * @since 2026-11-02 (ADR-923 §5.13)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'supplier_verifications',
)!;

describe('supplier_verifications.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
