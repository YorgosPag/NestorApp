/**
 * Firestore Rules — συλλογή `entity_audit_trail_personal` (ADR-864 Φ1β · ADR-195)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list:            `resource.data.userId == request.auth.uid`
 *   - create/update/delete: `if false` — γράφει **μόνο** ο `EntityAuditService` (Admin SDK)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Π1. Ο ΠΟΛΙΤΗΣ ΧΩΡΙΣ ΕΤΑΙΡΕΙΑ.** Κάθε persona του πίνακα κουβαλά claim `companyId`
 *   (μέχρι και ο `external_user`)· ο άνθρωπος για τον οποίο **υπάρχει** αυτό το βιβλίο (ADR-864
 *   Ε-1) δεν έχει. Μια 8η persona θα άλλαζε τα 35 κελιά **κάθε** συλλογής — εδώ δοκιμάζεται
 *   **ρητά**, με ταυτότητα χωρίς claim εταιρείας.
 *
 *   **Π2. «Rules are not filters».** Η αφιλτράριστη λίστα απορρίπτεται και για τον κάτοχο· και
 *   το φιλτραρισμένο ερώτημα του κατόχου **δεν** φέρνει το βιβλίο τρίτου.
 *
 *   **Π3. 🔴 Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΕΤΑΙΡΕΙΑΣ ΚΑΙ Ο SUPER ADMIN.** Το εταιρικό `entity_audit_trail` το
 *   διαβάζουν και οι δύο· το προσωπικό **κανείς από τους δύο** — ίδια ορατότητα με την ίδια την
 *   αγγελία (GitHub: το personal security log μόνο ο κάτοχος · Figma: ο admin δεν βλέπει Drafts).
 *
 * @since 2026-09-16 (ADR-864 Φ1β)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { personalAuditEntryPayload, seedPersonalAuditEntry } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = 'entity_audit_trail_personal';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'entity_audit_trail_personal',
)!;

/** Ο κάτοχος του σπαρμένου βιβλίου — ίδια σύμβαση με το `owner-properties.rules.test.ts`. */
const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
const DOC_ID = 'eaud-personal-1';

/** Άνθρωπος **χωρίς** claim εταιρείας — ο πληθυσμός του ADR-864 Ε-1. */
const CITIZEN_UID = 'citizen-without-company';

describe('entity_audit_trail_personal.rules — το προσωπικό βιβλίο το διαβάζει ΜΟΝΟ ο κάτοχος (ADR-864 Φ1β)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedPersonalAuditEntry(env, DOC_ID, OWNER_UID);

        const target: AssertTarget = {
          collection: COLLECTION,
          docId: DOC_ID,
          data: { action: 'updated' },
          createData: personalAuditEntryPayload(OWNER_UID),
          // 🔑 Το φίλτρο ονομάζει το uid ΤΟΥ ΚΑΤΟΧΟΥ: «ξέρω ποιανού ζητάω» δεν αρκεί.
          listFilter: { field: 'userId', op: '==', value: OWNER_UID },
        };

        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  describe('🔴 Π1 — ο ΠΟΛΙΤΗΣ χωρίς εταιρεία διαβάζει το ΔΙΚΟ ΤΟΥ βιβλίο', () => {
    it('get + φιλτραρισμένη λίστα → allow, με ταυτότητα ΧΩΡΙΣ claim `companyId`', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, CITIZEN_UID);
      const citizen = env.authenticatedContext(CITIZEN_UID, {});

      await assertSucceeds(citizen.firestore().collection(COLLECTION).doc(DOC_ID).get());
      const snap = await assertSucceeds(
        citizen.firestore().collection(COLLECTION).where('userId', '==', CITIZEN_UID).get(),
      );
      expect(snap.size).toBe(1);
    });

    it('🔴 ούτε ο κάτοχος γράφει — ούτε με έγκυρο φορτίο δικό του', async () => {
      const citizen = env.authenticatedContext(CITIZEN_UID, {});
      await assertFails(
        citizen.firestore().collection(COLLECTION).doc('eaud-self').set(personalAuditEntryPayload(CITIZEN_UID)),
      );
    });

    it('🔴 ξένος πολίτης → deny', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, CITIZEN_UID);
      const stranger = env.authenticatedContext('another-citizen', {});

      await assertFails(stranger.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });
  });

  describe('🔴 Π2 — rules are not filters', () => {
    it('αφιλτράριστη λίστα → deny ΚΑΙ για τον κάτοχο', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).get());
    });

    it('🔑 το φιλτραρισμένο ερώτημα του κατόχου ΔΕΝ φέρνει βιβλίο τρίτου', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, OWNER_UID);
      await seedPersonalAuditEntry(env, 'eaud-of-someone-else', PERSONA_CLAIMS.cross_tenant_user.uid);

      const snap = await assertSucceeds(
        getContext(env, 'same_tenant_user')
          .firestore()
          .collection(COLLECTION)
          .where('userId', '==', OWNER_UID)
          .get(),
      );
      expect(snap.docs.map((d) => d.id)).toEqual([DOC_ID]);
    });
  });

  describe('🔴 Π3 — ΟΥΤΕ ο admin της εταιρείας ΟΥΤΕ ο super admin', () => {
    it('admin της ΙΔΙΑΣ εταιρείας με τον κάτοχο → deny', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_admin').firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('super admin → deny (ίδια ορατότητα με την αγγελία)', async () => {
      await seedPersonalAuditEntry(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'super_admin').firestore().collection(COLLECTION).doc(DOC_ID).get());
    });
  });
});
