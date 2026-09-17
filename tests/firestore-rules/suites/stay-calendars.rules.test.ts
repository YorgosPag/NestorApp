/**
 * ADR-835 §20 — η κεφαλή του ημερολογίου καταλύματος. Δες
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
  (c) => c.collection === 'stay_calendars',
)!;

const payload: AuthorOwnedPayload = (authorUserId) => ({
  propertyId: 'ownp_seed',
  authorUserId,
  declaredAt: '2027-01-01T00:00:00.000Z',
  version: 3,
  timezone: 'Europe/Athens',
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
});

describe('stay_calendars.rules — ο συντάκτης διαβάζει, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useAuthorOwnedEmulator();
  for (const cell of COVERAGE.matrix) {
    defineAuthorOwnedCell(env, cell, COVERAGE.collection, payload);
  }
  defineAuthorOwnedAnchors(env, COVERAGE.collection, payload);
});
