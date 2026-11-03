/**
 * Firestore Rules — `supplier_brand_claims` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-923 §16.
 *
 * A client that could write here could declare itself the owner of any brand.
 *
 * @since 2026-11-02 (ADR-923 §16)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'supplier_brand_claims',
)!;

describe('supplier_brand_claims.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
