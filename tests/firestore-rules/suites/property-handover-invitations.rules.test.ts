/**
 * Firestore Rules — συλλογή `property_handover_invitations` (ADR-916 Φ-Β)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — την εκδίδει ο ΕΝΑΣ γραφέας της παράδοσης και την εξαργυρώνει το
 * `/api/property-handover-invitations/redeem` (Admin SDK).
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Χωρίς σπαρμένο έγγραφο του **ίδιου** γραφείου, το «λογικό»
 * χαλάρωμα `allow read: if isInternalUserOfCompany(resource.data.companyId)` **δεν** θα κοκκίνιζε — και θα έδινε σε κάθε
 * χρήστη του γραφείου τα email των αγοραστών, ή, με εγγραφή, `state: 'accepted'` χωρίς σύνδεσμο (φάκελος σε λάθος χέρια).
 *
 * @since 2026-10-19 (ADR-916 Φ-Β)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'property_handover_invitations';
const DOC_ID = 'phin_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_handover_invitations')!;

const INVITATION = {
  id: DOC_ID,
  inviteeEmail: 'buyer@example.test',
  invitedByUid: 'uid_seed_0001',
  nonceHash: 'a'.repeat(64),
  reissuedNonceHashes: [],
  state: 'pending',
  createdAt: '2026-10-19T09:00:00.000Z',
  expiresAt: '2026-11-18T09:00:00.000Z',
  openedAt: null,
  resolvedAt: null,
  resolvedByUid: null,
  mailboxProvenAt: null,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  handoverId: 'phov_seed_0001',
  contactId: 'cont_seed_0001',
  occasion: 'reservation',
};

describe('property_handover_invitations.rules — η πρόσκληση ζει ΜΟΝΟ στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(INVITATION);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει την πρόσκληση — θα έβλεπε το email του αγοραστή', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε την «αποδέχεται» — αλλιώς φάκελος σε λογαριασμό που δεν απέδειξε το γραμματοκιβώτιο', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ state: 'accepted', resolvedAt: '2026-10-19T10:00:00.000Z' }));
    });

    it('ούτε τη σβήνει — η ανάκληση είναι πράξη του διακομιστή', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
