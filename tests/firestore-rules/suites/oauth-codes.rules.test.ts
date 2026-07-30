/**
 * Firestore Rules — `oauth_codes` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-738.
 *
 * Holds single-use authorization codes awaiting exchange at `/token`. A code
 * is a bearer credential for the seconds it lives: anyone who can read one and
 * holds the matching verifier gets an access token. Enumeration is the whole
 * attack, so `list` is denied together with `get`.
 *
 * @since 2026-07-31 (ADR-738)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'oauth_codes',
)!;

describe('oauth_codes.rules — authorization codes are bearer credentials', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
