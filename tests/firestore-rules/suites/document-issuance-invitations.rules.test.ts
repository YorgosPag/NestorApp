/**
 * Firestore Rules — συλλογή `document_issuance_invitations` (ADR-915 §28)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — η έκδοση ανήκει στο `…/issuance-assignments/messages` (μία συναλλαγή
 * με την ανάθεση) και η απάντηση στην πόρτα του συνδέσμου (`/api/issuance-link/*`).
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Χωρίς σπαρμένο έγγραφο του **ίδιου** γραφείου, το «λογικό»
 * χαλάρωμα `allow read: if resource.data.companyId == getUserCompanyId()` **δεν** θα κοκκίνιζε — και θα έδινε σε κάθε
 * χρήστη του γραφείου τα email ιδιοκτητών και επαγγελματιών, ή, με εγγραφή, `state: 'accepted'` χωρίς σύνδεσμο.
 *
 * @since 2026-10-17 (ADR-915 §28)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'document_issuance_invitations';
const DOC_ID = 'diin_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'document_issuance_invitations')!;

const INVITATION = {
  id: DOC_ID,
  inviteeEmail: 'owner@example.test',
  invitedByUid: 'uid_seed_0001',
  nonceHash: 'a'.repeat(64),
  state: 'pending',
  createdAt: '2026-10-17T09:00:00.000Z',
  expiresAt: '2026-10-24T09:00:00.000Z',
  openedAt: null,
  resolvedAt: null,
  resolvedByUid: null,
  mailboxProvenAt: null,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  documentKind: 'energy-certificate',
  assignmentId: 'dias_seed_0001',
  audience: 'owner',
  contactId: 'cont_seed_0001',
};

describe('document_issuance_invitations.rules — ο σύνδεσμος ζει ΜΟΝΟ στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
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

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει τον σύνδεσμο — θα έβλεπε email ιδιοκτήτη', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε τον «απαντά» — αλλιώς έγκριση χωρίς τον ιδιοκτήτη, χωρίς σύνδεσμο', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ state: 'accepted', resolvedAt: '2026-10-17T10:00:00.000Z' }));
    });

    it('ούτε τον σβήνει — η ανάκληση είναι πράξη του διακομιστή', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
