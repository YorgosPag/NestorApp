/**
 * ADR-835 §20 — κλεισμένες νύχτες καταλύματος. Δες
 * `_harness/author-owned-server-written-suite.ts`.
 */
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineAuthorOwnedAnchors,
  defineAuthorOwnedCell,
  useAuthorOwnedEmulator,
  type AuthorOwnedPayload,
} from '../_harness/author-owned-server-written-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'stay_blocks',
)!;

const payload: AuthorOwnedPayload = (authorUserId) => ({
  propertyId: 'ownp_seed',
  authorUserId,
  covers: [{ propertyId: 'ownp_seed', spaceId: null }],
  from: '2027-10-10',
  to: '2027-10-14',
  source: 'owner',
  note: 'Ανακαίνιση μπάνιου',
  createdBy: authorUserId,
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
});

describe('stay_blocks.rules — ο συντάκτης διαβάζει, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useAuthorOwnedEmulator();
  for (const cell of COVERAGE.matrix) {
    defineAuthorOwnedCell(env, cell, COVERAGE.collection, payload);
  }
  defineAuthorOwnedAnchors(env, COVERAGE.collection, payload);
});
