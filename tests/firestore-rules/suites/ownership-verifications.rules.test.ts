/**
 * Firestore Rules — `ownership_verifications` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-900 §3.8.
 *
 * Holds one document per ownership-verification attempt (Land Registry certificate, ΠΚΑ): seal result, extracted fields, verdict and reasons.
 *
 * WRITES are the danger that matters: a client that could write here could mark ITSELF verified and unlock the exact demand count (`verified-owner`) without any certificate.
 *
 * READS are denied because the owner learns the status only through the server
 * route (a closed response shape), never by reading the collection.
 *
 * @since 2026-10-02 (ADR-900 §3.8)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'ownership_verifications',
)!;

describe('ownership_verifications.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
