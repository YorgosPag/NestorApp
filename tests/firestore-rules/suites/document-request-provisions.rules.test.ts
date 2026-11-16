/**
 * Firestore Rules — συλλογή `document_request_provisions` (ADR-942 Φ2 — «δόθηκε στον επαγγελματία»)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — γραφείο **και** επαγγελματίας περνούν από τον διακομιστή.
 * Από αυτό το έγγραφο **παράγεται** η πρόσβαση τρίτου σε αρχείο του κατόχου. Οι μεταλλάξεις που πρέπει να πιάνει:
 *
 *     allow create: if request.resource.data.companyId == getUserCompanyId();   // «το αρχείο είναι ΔΙΚΟ μας»
 *     allow update: if resource.data.companyId == getUserCompanyId();           // «ανακαλώ / ξανανοίγω μόνος μου»
 *     allow read:   if resource.data.companyId == getUserCompanyId();           // «βλέπω τι δόθηκε»
 *
 * Η πρώτη δίνει σε τρίτο ανάγνωση αρχείου **χωρίς** τον κριτή του κατόχου (ζωντανό · στο δοχείο · είδος του καταλόγου).
 * Η δεύτερη σβήνει μια ανάκληση χωρίς ίχνος. Η τρίτη λέει σε μέλος του γραφείου τι δόθηκε έξω από το ιστορικό. Γι' αυτό
 * το σπαρμένο έγγραφο ανήκει στον **ίδιο** μισθωτή.
 *
 * @since 2026-11-17 (ADR-942 Φ2)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'document_request_provisions',
)!;

const PROVISION_ID = 'cdp_anchor_0101';

function provisionDoc(id: string) {
  return {
    id,
    companyId: SAME_TENANT_COMPANY_ID,
    subject: { kind: 'document_issuance', id: 'dias_anchor_0001' },
    itemId: 'unit-permit',
    fileId: 'file_anchor_0001',
    via: 'existing',
    givenBy: PERSONA_CLAIMS.same_tenant_admin.uid,
    givenAt: '2026-11-17T08:00:00.000Z',
    revokedAt: '2026-11-17T09:00:00.000Z',
    revokedBy: PERSONA_CLAIMS.same_tenant_admin.uid,
  };
}

describe('document_request_provisions.rules — το δόσιμο ανήκει στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε το ίδιο το γραφείο ούτε ο επαγγελματίας', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection('document_request_provisions').doc(PROVISION_ID).set(provisionDoc(PROVISION_ID));
      });
    });

    it('ο διαχειριστής του ΙΔΙΟΥ μισθωτή διαβάζει δόσιμο ⇒ άρνηση (μόνο το ιστορικό το λέει)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('document_request_provisions').doc(PROVISION_ID).get());
    });

    it('ο διαχειριστής του ΙΔΙΟΥ μισθωτή «ξεανακαλεί» δόσιμο ⇒ άρνηση (καμία ανάκληση σβήνεται χωρίς ίχνος)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('document_request_provisions').doc(PROVISION_ID).update({ revokedAt: null, revokedBy: null }),
      );
    });

    it('ο διαχειριστής του ΙΔΙΟΥ μισθωτή δίνει αρχείο απευθείας ⇒ άρνηση (κανένας κριτής κατόχου)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('document_request_provisions').doc('cdp_anchor_0102')
          .set({ ...provisionDoc('cdp_anchor_0102'), revokedAt: null, revokedBy: null }),
      );
    });

    it('ο επαγγελματίας γράφει δόσιμο στον εαυτό του ⇒ άρνηση', async () => {
      const outsider = getContext(env(), 'external_user');
      await assertFails(
        outsider.firestore().collection('document_request_provisions').doc('cdp_anchor_0103')
          .set({ ...provisionDoc('cdp_anchor_0103'), revokedAt: null, revokedBy: null }),
      );
    });
  });
});
