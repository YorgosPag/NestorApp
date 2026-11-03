/**
 * Firestore Rules — `public_supplier_profiles` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-923 §22 Υ8.
 *
 * The anonymous visitor reads it through a server page, behind the showcase gate.
 *
 * @since 2026-11-02 (ADR-923 §22)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'public_supplier_profiles',
)!;

describe('public_supplier_profiles.rules — server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
