/**
 * Firestore Rules — `function_event_records` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-873 Φ1 §9.1.
 *
 * One document per observed Cloud Functions event: the «this change was already applied»
 * marker. The trigger platform is at-least-once, so this record is what stops a redelivered
 * event from running the work twice. Both halves are dangerous in a client's hands.
 *
 * Write: a forged record declares «already done» for a change that never happened — it
 * silently cancels a search-index update, an audit line or a price-average blend; a forged
 * `in-flight` record blocks the operation until the lease expires.
 * Read: the key itself carries a document path plus commit times — WHO changed WHAT and
 * WHEN, per company. There is no legitimate client read.
 *
 * @since 2026-09-22 (ADR-873 Φ1 §9.1 · Στάδιο 0)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'function_event_records',
)!;

describe('function_event_records.rules — the «already applied» marker is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
