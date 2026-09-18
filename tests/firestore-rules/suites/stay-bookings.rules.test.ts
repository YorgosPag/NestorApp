/**
 * ADR-835 §20 — κρατήσεις καταλύματος. Κουβαλούν άνθρωπο (ιδιωτική σημείωση του
 * οικοδεσπότη), άρα η άγκυρα «δεν διαρρέει σε τρίτους» είναι εδώ η πιο σημαντική. Δες
 * `_harness/author-owned-server-written-suite.ts`.
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { getContext, withSeedContext } from '../_harness/auth-contexts';
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

/**
 * 🎯 ADR-835 §23 (Στάδιο Δ) — **ο ΕΠΙΣΚΕΠΤΗΣ διαβάζει τα ΔΙΚΑ του αιτήματα**, τίποτα παραπάνω.
 *
 * 🔑 Η άγκυρα είναι **ασύμμετρη επίτηδες**: συντάκτης ΑΛΛΟΣ, επισκέπτης ο δοκιμαζόμενος. Αν ο κανόνας
 * ρωτούσε μόνο `authorUserId`, ο επισκέπτης δεν θα έβλεπε ποτέ το αίτημά του (και θα ζητούσε ξανά)·
 * αν ρωτούσε οτιδήποτε ευρύτερο, θα έβλεπε ξένα αιτήματα — δηλαδή ημερομηνίες και ονόματα τρίτων.
 */
describe('stay_bookings.rules — Στάδιο Δ: ο επισκέπτης και το αίτημά του', () => {
  const env = useAuthorOwnedEmulator();
  const GUEST_UID = PERSONA_CLAIMS.same_tenant_user.uid;
  const AUTHOR_UID = PERSONA_CLAIMS.cross_tenant_user.uid;

  const requestPayload = (guestUserId: string) => ({
    ...payload(AUTHOR_UID),
    holder: { kind: 'user', userId: guestUserId, displayName: null },
    channel: 'platform',
    lifecycle: 'requested',
    hold: { expiresAt: '2099-01-01T00:00:00.000Z', tier: 'distant', bound: 'response-hours', respondentUserId: AUTHOR_UID },
    resolution: null,
    guestUserId,
  });

  async function seedRequests(): Promise<void> {
    await withSeedContext(env(), async (ctx) => {
      await ctx.firestore().collection('stay_bookings').doc('stay_mine').set(requestPayload(GUEST_UID));
      await ctx.firestore().collection('stay_bookings').doc('stay_theirs').set(requestPayload('someone_else'));
    });
  }

  it('ο επισκέπτης διαβάζει το ΔΙΚΟ του αίτημα — και με ερώτημα φιλτραρισμένο στον εαυτό του', async () => {
    await seedRequests();
    const guest = getContext(env(), 'same_tenant_user').firestore().collection('stay_bookings');
    await assertSucceeds(guest.doc('stay_mine').get());
    const snap = await assertSucceeds(guest.where('guestUserId', '==', GUEST_UID).get());
    expect(snap.docs.map((doc) => doc.id)).toEqual(['stay_mine']);
  });

  it('🔴 ΔΕΝ διαβάζει ξένο αίτημα — ούτε με ερώτημα στο πεδίο του άλλου', async () => {
    await seedRequests();
    const guest = getContext(env(), 'same_tenant_user').firestore().collection('stay_bookings');
    await assertFails(guest.doc('stay_theirs').get());
    await assertFails(guest.where('guestUserId', '==', 'someone_else').get());
  });

  it('🔴 ΔΕΝ γράφει — ούτε «αποδέχεται» το δικό του αίτημα, ούτε παρατείνει την προθεσμία του', async () => {
    await seedRequests();
    const guest = getContext(env(), 'same_tenant_user').firestore().collection('stay_bookings');
    await assertFails(guest.doc('stay_mine').update({ lifecycle: 'confirmed' }));
    await assertFails(guest.doc('stay_mine').update({ 'hold.expiresAt': '2199-01-01T00:00:00.000Z' }));
  });
});
