/**
 * Firestore Rules — `workspace_aliases` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-787 §5.3 δ · Κ-1.
 *
 * One document per alias **skeleton** (UTS #39), mapping a workspace name to a
 * `companyId`. Uniqueness is enforced by the document key itself: the registry
 * writes with `create()`, which fails if the document already exists.
 *
 * ⚠️ Until 2026-08-25 this collection had **zero documents and zero callers** —
 * `claimAlias` was written and never wired. The Κ-1 chain connected it, and from
 * that moment every signed-in user can reserve a name. Silence stopped being
 * harmless, so the denial is written out explicitly instead of being inherited
 * from default-deny — the same reasoning as `cron_job_state` and `oauth_*`.
 *
 * WRITES are the obvious danger: whoever can write here can **steal or squat**
 * another office's name, because the key *is* the lock.
 *
 * READS are denied for a less obvious reason, and it is the important one: the
 * question *"which workspace owns this name?"* is answered **only** on the
 * server. A client that could read — even a single point lookup by key — would
 * turn the index into an **enumeration oracle** for offices, which ADR-787
 * Ε-5 §4 #1 forbids outright. That is why there is no `read` branch at all.
 *
 * @since 2026-08-25 (ADR-787 Κ-1)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'workspace_aliases',
)!;

describe('workspace_aliases.rules — the name registry is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
