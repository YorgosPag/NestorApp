/**
 * Firestore Rules — συλλογή `property_handover_protocols` (ADR-916 Φ-Γ2 / ADR-918 — το μητρώο πρωτοκόλλων παράδοσης)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γράφει ΜΟΝΟ ο γραφέας του πρωτοκόλλου (Admin SDK)· η πόρτα
 * επαλήθευσης και η όψη του γραφείου περνούν από διαδρομή διακομιστή.
 *
 * 🔴 **Το κελί που έχει σημασία είναι του ΙΔΙΟΥ μισθωτή.** Αν το γραφείο μπορούσε να γράψει εδώ, θα «κατοχύρωνε» στο
 * μητρώο ένα PDF που δεν σφράγισε ποτέ ο διακομιστής — και η πόρτα επαλήθευσης θα το έλεγε «γνήσιο».
 *
 * @since 2026-10-21 (ADR-916 Φ-Γ2)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

const COLLECTION = 'property_handover_protocols';
const DOC_ID = 'phpr_seed_0001';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_handover_protocols')!;

const PROTOCOL = {
  id: DOC_ID,
  companyId: SAME_TENANT_COMPANY_ID,
  propertyId: 'prop_seed_0001',
  handoverId: 'phov_seed_0001',
  revision: 1,
  ledgerDigest: 'a'.repeat(64),
  pdfSha256: 'b'.repeat(64),
  supersedesProtocolId: null,
  issuedAt: '2026-10-21T09:00:00.000Z',
};

describe('property_handover_protocols.rules — το μητρώο πρωτοκόλλων ζει ΜΟΝΟ στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ ο μισθωτής', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set(PROTOCOL);
      });
    });

    it('ο διαχειριστής του γραφείου ΔΕΝ διαβάζει απευθείας — κρατά τον παραλήπτη (Δ10)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('🔴 ούτε «κατοχυρώνει» PDF που δεν σφράγισε ο διακομιστής', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc('phpr_forged_0001').set({ ...PROTOCOL, id: 'phpr_forged_0001' }));
    });

    it('ούτε αλλάζει ή σβήνει αναθεώρηση — το μητρώο είναι αμετάβλητο', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).update({ pdfSha256: 'c'.repeat(64) }));
      await assertFails(admin.firestore().collection(COLLECTION).doc(DOC_ID).delete());
    });
  });
});
