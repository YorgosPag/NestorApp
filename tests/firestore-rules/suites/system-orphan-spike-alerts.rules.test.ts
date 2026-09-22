/**
 * Firestore Rules — `system_orphan_spike_alerts` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-694 · Ε-873.8.
 *
 * One document per UTC hour (`yyyy-MM-ddTHH`): the bucket the orphan-spike watchdog fills
 * when storage orphans exceed their threshold. Written ONLY by `orphanSpikeAlert`.
 *
 * Write: writing here means «swallow the spike alert» — the watchdog reads the bucket to
 * decide whether it already alerted for this hour, so a forged bucket silences it.
 * Read: the bucket exposes storage-health counters across the whole platform.
 *
 * ⚠️ Until 2026-09-22 this collection had no rule block at all. The check was silent
 * because its only writer is the Admin SDK, which bypasses rules — and silence is not a
 * decision. The explicit denial is the decision.
 *
 * @since 2026-09-22 (ADR-873 §9.2.1 · Ε-873.8)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'system_orphan_spike_alerts',
)!;

describe('system_orphan_spike_alerts.rules — the spike bucket is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
