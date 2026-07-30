/**
 * Firestore Rules — `oauth_auth_requests` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-738.
 *
 * Holds in-flight authorization requests: the PKCE `code_challenge`, the
 * requested scopes, and the state parameter, between the `/authorize` redirect
 * and the user's consent decision. Readable challenges would let a local
 * attacker pre-compute or swap the verifier and complete someone else's flow.
 *
 * @since 2026-07-31 (ADR-738)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'oauth_auth_requests',
)!;

describe('oauth_auth_requests.rules — PKCE challenges never reach a client', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
