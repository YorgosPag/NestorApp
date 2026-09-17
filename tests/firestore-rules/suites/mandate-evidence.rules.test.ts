/**
 * Firestore Rules — `mandate_evidence` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-864 §20 · §21.
 *
 * One document per **frozen copy** of a mandate attestation (`mandate-evidence/`
 * in the bucket): retention state, `retainUntil`, legal hold, tombstone.
 *
 * WRITES are the danger that matters: a client that could write here could
 * **shorten** the retention or **release** a legal hold, and the retention cron
 * would then delete consent evidence the law requires to survive.
 *
 * READS are denied because access to the evidence is judged **only** on the
 * server (`services/mandate/mandate-evidence-access.ts`: a relationship judge
 * plus a `document_accessed` audit entry) — a client read would bypass both.
 *
 * Until 2026-09-17 the collection relied on default-deny. The denial is now
 * explicit for the same reason as `cron_job_state`, `oauth_*` and
 * `workspace_aliases`: default-deny is correct today and fragile tomorrow.
 *
 * @since 2026-09-17 (ADR-864 §21.7 #2)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'mandate_evidence',
)!;

describe('mandate_evidence.rules — the evidence registry is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
