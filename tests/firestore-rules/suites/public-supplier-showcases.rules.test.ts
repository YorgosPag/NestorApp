/**
 * Firestore Rules — `public_supplier_showcases` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-923 §5.13 Δ6.
 *
 * The name says public, the collection does not: the anonymous visitor reads it through a server page.
 * WRITES are the danger: a client that could write here could publish itself as a verified supplier.
 *
 * @since 2026-11-02 (ADR-923 §5.13)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'public_supplier_showcases',
)!;

describe('public_supplier_showcases.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
