/**
 * Firestore Rules — συλλογή `property_handover_deliveries` (ADR-916 Φ-Γ1 — το καθολικό παράδοσης)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφει ΜΟΝΟ ο εκτελεστής της παράδοσης (Admin SDK)· η όψη του
 * γραφείου (Φ-Δ) θα περάσει από διαδρομή διακομιστή.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Το «λογικό» χαλάρωμα `allow read: if
 * isInternalUserOfCompany(resource.data.companyId)` δεν θα κοκκίνιζε χωρίς σπαρμένο έγγραφο του **ίδιου** γραφείου — και
 * με εγγραφή θα επέτρεπε στο γραφείο να «αποδείξει» παράδοση αρχείου που ο αγοραστής δεν πήρε ποτέ.
 *
 * @since 2026-10-20 (ADR-916 Φ-Γ1)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'property_handover_deliveries';
const DOC_ID = 'phdl_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_handover_deliveries')!;

const DELIVERY = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  handoverId: 'phov_seed_0001',
  recipientUserId: 'uid_buyer_0001',
  dossierId: 'pdos_seed_0001',
  sourceFileId: 'file_company_0001',
  sourceGeneration: '1729414800000000',
  copyFileId: 'file_copy_0001',
  crc32c: 'AAAAAA==',
  size: 2048,
  revisionOfFileId: null,
  deliveredAt: '2026-10-20T09:00:00.000Z',
};

describe('property_handover_deliveries.rules — το καθολικό παράδοσης ζει ΜΟΝΟ στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(DELIVERY);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει απευθείας — η όψη του περνά από διαδρομή διακομιστή (Φ-Δ)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε «αποδεικνύει» παράδοση που δεν έγινε — γέννηση γραμμής χωρίς αντίγραφο', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc('phdl_forged_0001').set({ ...DELIVERY, id: 'phdl_forged_0001' }));
    });

    it('ούτε αλλάζει ή σβήνει ό,τι παραδόθηκε — η απόδειξη είναι αμετάβλητη', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ crc32c: 'BBBBBB==' }));
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
