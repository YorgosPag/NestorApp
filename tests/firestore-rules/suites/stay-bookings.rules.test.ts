/**
 * ADR-835 §20 — κρατήσεις καταλύματος. Κουβαλούν άνθρωπο (ιδιωτική σημείωση του
 * οικοδεσπότη), άρα η άγκυρα «δεν διαρρέει σε τρίτους» είναι εδώ η πιο σημαντική. Δες
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
  (c) => c.collection === 'stay_bookings',
)!;

const payload: AuthorOwnedPayload = (authorUserId) => ({
  propertyId: 'ownp_seed',
  offerKind: 'leaseShort',
  covers: [{ propertyId: 'ownp_seed', spaceId: null }],
  checkIn: '2027-10-14',
  checkOut: '2027-10-18',
  holder: { kind: 'offline', label: 'κ. Παπαδόπουλος' },
  channel: 'direct',
  authorUserId,
  guests: 2,
  lifecycle: 'confirmed',
  riskDisclosedAt: null,
  createdAt: '2027-01-01T00:00:00.000Z',
  updatedAt: '2027-01-01T00:00:00.000Z',
});

describe('stay_bookings.rules — ο συντάκτης διαβάζει, γράφει ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useAuthorOwnedEmulator();
  for (const cell of COVERAGE.matrix) {
    defineAuthorOwnedCell(env, cell, COVERAGE.collection, payload);
  }
  defineAuthorOwnedAnchors(env, COVERAGE.collection, payload);
});
