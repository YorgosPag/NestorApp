/**
 * Firestore Rules — `oauth_consents` collection
 *
 * Pattern: deny_all (server-only via Admin SDK) — ADR-738.
 *
 * Holds the record of which user granted which scopes to which client. Client
 * write access would let a page forge a consent and skip the approval screen
 * entirely; client read access would leak the connected-agent graph.
 *
 * The "connected agents" screen does show this data — but through an API route
 * backed by the Admin SDK, which returns a projection (client name, scopes,
 * date) and no credential material. Visibility exists; it just does not travel
 * through the rules.
 *
 * @since 2026-07-31 (ADR-738)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'oauth_consents',
)!;

describe('oauth_consents.rules — consent is granted server-side only', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
