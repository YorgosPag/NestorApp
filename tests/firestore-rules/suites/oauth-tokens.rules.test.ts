/**
 * Firestore Rules — `oauth_tokens` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-738.
 *
 * Holds SHA-256 hashes of issued access and refresh tokens plus their expiry
 * timestamps. The hashes are not directly replayable, but exposing them hands
 * an attacker offline-attack material and — via the expiry fields — a timing
 * oracle over who is connected and when their session turns over.
 *
 * @since 2026-07-31 (ADR-738)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'oauth_tokens',
)!;

describe('oauth_tokens.rules — token hashes stay server-side', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
