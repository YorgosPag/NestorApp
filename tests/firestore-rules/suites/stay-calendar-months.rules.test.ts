/**
 * ADR-835 §21 — κανόνες ανά ημερομηνία καταλύματος. Δες
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
  (c) => c.collection === 'stay_calendar_months',
)!;

const payload: AuthorOwnedPayload = (authorUserId) => ({
  propertyId: 'ownp_seed',
  authorUserId,
  month: '2027-10',
  days: { '2027-10-10': { minNights: 3, nightlyRateMinor: 12000 } },
  updatedAt: '2027-01-01T00:00:00.000Z',
});

describe('stay_calendar_months.rules — ο συντάκτης διαβάζει, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useAuthorOwnedEmulator();
  for (const cell of COVERAGE.matrix) {
    defineAuthorOwnedCell(env, cell, COVERAGE.collection, payload);
  }
  defineAuthorOwnedAnchors(env, COVERAGE.collection, payload);
});
