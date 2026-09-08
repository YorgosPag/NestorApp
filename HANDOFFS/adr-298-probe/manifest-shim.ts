/**
 * ΠΕΙΡΑΜΑ (ADR-298) — δεν μπαίνει σε commit.
 * Γεμίζει κάθε εγγραφή του μητρώου στα πλήρη 35 κελιά, δηλώνοντας τα ΛΕΙΠΟΝΤΑ ως `deny`.
 * Αποτυχία = η πραγματικότητα ΕΠΕΤΡΕΨΕ την πράξη ⇒ πραγματικό κενό κανόνα.
 */
import {
  FIRESTORE_RULES_COVERAGE as REAL,
  type CollectionCoverage,
  type CoverageCell,
} from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/coverage-manifest';
import { ALL_PERSONAS } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/personas';
import { ALL_OPERATIONS } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/operations';

export * from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/coverage-manifest';

const PROBE_REASON = 'cross_tenant' as const;

export const FIRESTORE_RULES_COVERAGE: readonly CollectionCoverage[] = REAL.map((entry) => {
  const have = new Set(entry.matrix.map((c) => `${c.persona}:${c.operation}`));
  const added: CoverageCell[] = [];
  for (const persona of ALL_PERSONAS) {
    for (const operation of ALL_OPERATIONS) {
      if (!have.has(`${persona}:${operation}`)) {
        added.push({ persona, operation, outcome: 'deny', reason: PROBE_REASON });
      }
    }
  }
  return { ...entry, matrix: [...entry.matrix, ...added] };
});
