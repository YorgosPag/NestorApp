/**
 * Firestore Rules — `tax_identity_claims` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-900 §3.8.
 *
 * Holds the uniqueness lock «one tax id (ΑΦΜ) = one account» (deterministic id from an HMAC of the ΑΦΜ; the ΑΦΜ itself is never stored).
 *
 * WRITES are the danger that matters: a client that could write here could squat another person's ΑΦΜ and block their verification.
 *
 * READS are denied because the owner learns the status only through the server
 * route (a closed response shape), never by reading the collection.
 *
 * @since 2026-10-02 (ADR-900 §3.8)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'tax_identity_claims',
)!;

describe('tax_identity_claims.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
