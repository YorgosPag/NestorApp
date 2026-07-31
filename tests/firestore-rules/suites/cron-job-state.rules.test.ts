/**
 * Firestore Rules — `cron_job_state` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-740.
 *
 * One document per scheduled job slug, holding `lastSuccessAt`, `leaseExpiresAt`
 * and `consecutiveFailures`. It contains nothing secret — and that is exactly why
 * the deny is easy to under-estimate.
 *
 * A client that could write here would extend a lease indefinitely; the dispatcher
 * would then skip that job as "already running", forever. Backups stop, purges stop,
 * and no other collection changes and no error is raised. That is the same silent
 * failure shape that let the crons sit dead for three months (ADR-740 §1) — so the
 * denial is written out explicitly instead of being inherited from default-deny.
 *
 * Reads are denied too: the document is a liveness oracle. Knowing when a purge job
 * last succeeded tells an attacker exactly how long a soft-deleted record survives.
 *
 * @since 2026-07-31 (ADR-740)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'cron_job_state',
)!;

describe('cron_job_state.rules — the schedule lock is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
