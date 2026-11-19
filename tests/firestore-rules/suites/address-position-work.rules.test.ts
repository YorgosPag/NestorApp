/**
 * Firestore Rules — `address_position_work` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-332 §D33.
 *
 * One document per contact/project/building that has an address whose position is not
 * settled yet, with an attempt counter and an exponential-backoff `dueAt`. The sweep
 * `address-position-sweep` is its only reader and writer.
 *
 * Write: a client that deletes an entry (or pushes `dueAt` into the far future) stops the
 * position from ever being completed — silently.
 * Read: which documents of OTHER workspaces exist and are pending.
 *
 * @since 2026-11-19
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'address_position_work',
)!;

describe('address_position_work.rules — the position work registry is server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
