/**
 * Firestore Rules — `shares` collection (ADR-884 Φ0.12 · ADR-315)
 *
 * Pattern: deny_all (`shareLinksMatrix`) — server-only share links.
 *
 * 🔴 Until 2026-09-25 this rule was `allow read: if true` with an anonymous
 * counter write — and the collection had **no suite at all** (it sat in the
 * manifest's `TODO(ADR-298 Phase D)` list). The one collection whose hole a
 * suite would have shown was the one without a suite.
 *
 * @since 2026-09-25 (ADR-884 Φ0.12)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { defineShareLinkAnchors } from '../_harness/share-link-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'shares',
)!;

describe('shares.rules — server-only share links', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  defineShareLinkAnchors(env, 'shares');
});
