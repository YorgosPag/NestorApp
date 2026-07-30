/**
 * Firestore Rules — `accounting_invoice_counters` collection
 *
 * Pattern: deny_all (Pattern E — server-only via Admin SDK).
 *
 * Rule: `allow read, write: if false` — no client access whatsoever.
 * Invoice counters contain internal sequencing data (auto-increment counters
 * for invoice number generation). They are read and incremented exclusively
 * by the Admin SDK server-side; no client persona can access them.
 *
 * All (persona × operation) cells produce deny with `server_only` reason.
 * The test verifies that even super_admin is blocked (no `isSuperAdminOnly()`
 * short-circuit exists — the rule is a blanket false).
 *
 * See ADR-298 §4 Phase C.1 (2026-04-13).
 *
 * 2026-07-31 (ADR-738): το σώμα του κελιού πέρασε στο `_harness/deny-all-suite`.
 * Δεν χρειάζεται seeder — ούτε τότε χρειαζόταν: με `allow read, write: if false`
 * ο κανόνας αποφασίζει πριν κοιτάξει έγγραφο, οπότε το αν υπάρχει το doc ή τι
 * γράφει μέσα δεν αλλάζει ούτε ένα κελί.
 *
 * @since 2026-04-13 (ADR-298 Phase C.1)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'accounting_invoice_counters',
)!;

describe('accounting_invoice_counters.rules — invoice sequencing is server-owned', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
