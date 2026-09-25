/**
 * Firestore Rules — `file_shares` collection (ADR-884 Φ0.12)
 *
 * Pattern: deny_all (`shareLinksMatrix`) — server-only share links.
 *
 * 🔴 Until 2026-09-25 this rule was `allow read: if true` (anonymous enumeration
 * of every token + its unsalted password hash) with an anonymous counter write.
 * The whole lifecycle now runs on the server (`src/server/sharing/*`).
 *
 * @since 2026-04-14 (ADR-298 Phase C.3) · server-only 2026-09-25 (ADR-884 Φ0.12)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { defineShareLinkAnchors } from '../_harness/share-link-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'file_shares',
)!;

describe('file_shares.rules — server-only share links', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  defineShareLinkAnchors(env, 'file_shares');
});
