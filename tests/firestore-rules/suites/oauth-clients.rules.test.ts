/**
 * Firestore Rules — `oauth_clients` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-738.
 *
 * Holds registered OAuth 2.1 client metadata: redirect URI allowlists,
 * granted scopes, and client secrets. A client whose redirect allowlist can be
 * read (let alone written) from a browser is a client whose authorization
 * codes can be redirected to an attacker, so the rule is a blanket
 * `if false` — no persona, super_admin included, gets a short-circuit.
 *
 * @since 2026-07-31 (ADR-738)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'oauth_clients',
)!;

describe('oauth_clients.rules — client registry is Admin-SDK-only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
