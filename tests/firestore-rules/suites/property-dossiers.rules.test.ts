/**
 * Firestore Rules — συλλογή `property_dossiers` (ADR-866 Ε-1 · Φ1.1)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - read/list:            `resource.data.userId == request.auth.uid`
 *   - create/update/delete: `if false` — γράφει **μόνο** το `property-dossier-write.service` (Admin SDK)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Π1. Ο ΠΟΛΙΤΗΣ ΧΩΡΙΣ ΕΤΑΙΡΕΙΑ** — ο άνθρωπος για τον οποίο **υπάρχει** ο φάκελος. Κάθε persona
 *   του πίνακα κουβαλά claim `companyId`· εδώ δοκιμάζεται **ρητά** ταυτότητα χωρίς εταιρεία.
 *   **Π2. «Rules are not filters»** — η αφιλτράριστη λίστα απορρίπτεται και για τον κάτοχο· το
 *   φιλτραρισμένο ερώτημά του **δεν** φέρνει φάκελο τρίτου.
 *   **Π3. ΟΥΤΕ admin εταιρείας ΟΥΤΕ super admin** — ό,τι αφορά το σπίτι ενός ανθρώπου.
 *   **Π4. ΟΥΤΕ ο κάτοχος γράφει** — ούτε γέννηση, ούτε αλλαγή κατόχου, ούτε διαγραφή: η γέννηση πρέπει
 *   να μπορεί να γίνει στην **ίδια** δέσμη με την αγγελία (Ε-Φ1-1), και το ίχνος είναι ιδιότητα της
 *   διαδρομής γραφής του διακομιστή.
 *   **Π5. 🔑 Ο ΚΑΤΟΧΟΣ ΕΙΝΑΙ `userId`, ΟΧΙ `authorUserId`** (§2.8.7 Δ1) — ένας φάκελος γραμμένος με το
 *   λεξιλόγιο της αγγελίας δεν διαβάζεται από κανέναν.
 *
 * @since 2026-09-18 (ADR-866 Φ1.1)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { propertyDossierPayload, seedPropertyDossier } from '../_harness/seed-helpers';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

const COLLECTION = 'property_dossiers';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'property_dossiers')!;

/** Ο κάτοχος του σπαρμένου φακέλου — ίδια σύμβαση με το `owner-properties.rules.test.ts`. */
const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
const DOC_ID = 'pdos-seeded-1';

/** Άνθρωπος **χωρίς** claim εταιρείας — ο πληθυσμός του ADR-866 Ε-1. */
const CITIZEN_UID = 'citizen-without-company';

describe('property_dossiers.rules — τον φάκελο τον διαβάζει ΜΟΝΟ ο κάτοχος, τον γράφει ΜΟΝΟ ο διακομιστής (ADR-866 Φ1.1)', () => {
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
        await seedPropertyDossier(env, DOC_ID, OWNER_UID);

        const target: AssertTarget = {
          collection: COLLECTION,
          docId: DOC_ID,
          data: { label: 'Μετονομασία από τον πελάτη' },
          createData: propertyDossierPayload(OWNER_UID),
          // 🔑 Το φίλτρο ονομάζει το uid ΤΟΥ ΚΑΤΟΧΟΥ: «ξέρω ποιανού ζητάω» δεν αρκεί.
          listFilter: { field: 'userId', op: '==', value: OWNER_UID },
        };

        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  describe('🔴 Π1 — ο ΠΟΛΙΤΗΣ χωρίς εταιρεία διαβάζει τον ΔΙΚΟ ΤΟΥ φάκελο', () => {
    it('get + φιλτραρισμένη λίστα → allow, με ταυτότητα ΧΩΡΙΣ claim `companyId`', async () => {
      await seedPropertyDossier(env, DOC_ID, CITIZEN_UID);
      const citizen = env.authenticatedContext(CITIZEN_UID, {});

      await assertSucceeds(citizen.firestore().collection(COLLECTION).doc(DOC_ID).get());
      const snap = await assertSucceeds(
        citizen.firestore().collection(COLLECTION).where('userId', '==', CITIZEN_UID).get(),
      );
      expect(snap.size).toBe(1);
    });

    it('🔴 ξένος πολίτης → deny', async () => {
      await seedPropertyDossier(env, DOC_ID, CITIZEN_UID);
      const stranger = env.authenticatedContext('another-citizen', {});

      await assertFails(stranger.firestore().collection(COLLECTION).doc(DOC_ID).get());
    });
  });

  describe('🔴 Π2 — rules are not filters', () => {
    it('αφιλτράριστη λίστα → deny ΚΑΙ για τον κάτοχο', async () => {
      await seedPropertyDossier(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).get());
    });

    it('🔑 το φιλτραρισμένο ερώτημα του κατόχου ΔΕΝ φέρνει φάκελο τρίτου', async () => {
      await seedPropertyDossier(env, DOC_ID, OWNER_UID);
      await seedPropertyDossier(env, 'pdos-of-someone-else', PERSONA_CLAIMS.cross_tenant_user.uid);

      const snap = await assertSucceeds(
        getContext(env, 'same_tenant_user').firestore().collection(COLLECTION).where('userId', '==', OWNER_UID).get(),
      );
      expect(snap.docs.map((d) => d.id)).toEqual([DOC_ID]);
    });
  });

  describe('🔴 Π3 — ΟΥΤΕ ο admin της εταιρείας ΟΥΤΕ ο super admin', () => {
    it('admin της ΙΔΙΑΣ εταιρείας με τον κάτοχο → deny', async () => {
      await seedPropertyDossier(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'same_tenant_admin').firestore().collection(COLLECTION).doc(DOC_ID).get());
    });

    it('super admin → deny', async () => {
      await seedPropertyDossier(env, DOC_ID, OWNER_UID);
      await assertFails(getContext(env, 'super_admin').firestore().collection(COLLECTION).doc(DOC_ID).get());
    });
  });

  describe('🔴 Π4 — ΟΥΤΕ ο κάτοχος γράφει', () => {
    it('γέννηση από τον πελάτη, με έγκυρο δικό του φορτίο → deny', async () => {
      const citizen = env.authenticatedContext(CITIZEN_UID, {});
      await assertFails(
        citizen.firestore().collection(COLLECTION).doc('pdos-self').set(propertyDossierPayload(CITIZEN_UID)),
      );
    });

    it('αρχειοθέτηση / αλλαγή κατόχου / διαγραφή του ΔΙΚΟΥ του → deny', async () => {
      await seedPropertyDossier(env, DOC_ID, CITIZEN_UID);
      const doc = env.authenticatedContext(CITIZEN_UID, {}).firestore().collection(COLLECTION).doc(DOC_ID);

      await assertFails(doc.update({ lifecycle: 'archived' }));
      await assertFails(doc.update({ userId: 'someone-else' }));
      await assertFails(doc.delete());
    });
  });

  describe('🔑 Π5 — ο κάτοχος είναι `userId`, όχι `authorUserId`', () => {
    it('φάκελος γραμμένος με το λεξιλόγιο της αγγελίας → ΚΑΝΕΙΣ δεν τον διαβάζει', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const withoutOwner = Object.fromEntries(
          Object.entries(propertyDossierPayload(CITIZEN_UID)).filter(([field]) => field !== 'userId'),
        );
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).set({ ...withoutOwner, authorUserId: CITIZEN_UID });
      });
      await assertFails(env.authenticatedContext(CITIZEN_UID, {}).firestore().collection(COLLECTION).doc(DOC_ID).get());
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ADR-916 Φ-Ε1 — `property_dossiers/{pdos}/engagements/{eng}`: η άδεια ζει ΚΑΤΩ από τον πόρο (Α1).
  // Φωλιασμένο μπλοκ ⇒ ελέγχεται εδώ, όπως οι συμμετοχές έργου στο `companies.rules.test.ts`.
  // ────────────────────────────────────────────────────────────────────────────
  describe('🤝 Π6 — συμμετοχές του φακέλου: ο καλεσμένος τη ΔΙΚΗ του, ο ΣΗΜΕΡΙΝΟΣ κάτοχος όλες, κανείς δεν γράφει', () => {
    const ENGAGEMENT_ID = 'eng-seeded-1';
    const PRO_UID = 'invited-lawyer';

    async function seedDossierEngagement(dossierOwner: string): Promise<void> {
      await seedPropertyDossier(env, DOC_ID, dossierOwner);
      await env.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection(COLLECTION).doc(DOC_ID).collection('engagements').doc(ENGAGEMENT_ID).set({
          id: ENGAGEMENT_ID, uid: PRO_UID, state: 'active', subject: { kind: 'property_dossier', dossierId: DOC_ID },
        });
      });
    }

    function engagementsOf(uid: string) {
      return env.authenticatedContext(uid, {}).firestore().collection(COLLECTION).doc(DOC_ID).collection('engagements');
    }

    it('ο καλεσμένος διαβάζει τη ΔΙΚΗ του συμμετοχή → allow', async () => {
      await seedDossierEngagement(CITIZEN_UID);
      await assertSucceeds(engagementsOf(PRO_UID).doc(ENGAGEMENT_ID).get());
    });

    it('ο κάτοχος βλέπει ΟΛΕΣ τις συμμετοχές του φακέλου του (λίστα χωρίς φίλτρο) → allow', async () => {
      await seedDossierEngagement(CITIZEN_UID);
      const snap = await assertSucceeds(engagementsOf(CITIZEN_UID).get());
      expect(snap.size).toBe(1);
    });

    it('🔴 ο ΠΡΩΗΝ κάτοχος (ο φάκελος άλλαξε χέρια) → deny — ο κάτοχος διαβάζεται από τον γονέα, όχι από αντίγραφο', async () => {
      await seedDossierEngagement('new-owner');
      await assertFails(engagementsOf(CITIZEN_UID).doc(ENGAGEMENT_ID).get());
    });

    it('🔴 ξένος · admin εταιρείας · super admin → deny', async () => {
      await seedDossierEngagement(OWNER_UID);
      await assertFails(engagementsOf('another-citizen').doc(ENGAGEMENT_ID).get());
      for (const persona of ['same_tenant_admin', 'super_admin'] as const) {
        await assertFails(
          getContext(env, persona).firestore().collection(COLLECTION).doc(DOC_ID).collection('engagements').doc(ENGAGEMENT_ID).get(),
        );
      }
    });

    it('🔴 ΚΑΝΕΙΣ δεν γράφει — ούτε ο κάτοχος, ούτε ο καλεσμένος (αυτο-πρόσκληση / αυτο-ανανέωση)', async () => {
      await seedDossierEngagement(CITIZEN_UID);
      await assertFails(engagementsOf(CITIZEN_UID).doc('eng-self').set({ uid: CITIZEN_UID, state: 'active' }));
      await assertFails(engagementsOf(PRO_UID).doc(ENGAGEMENT_ID).update({ expiresAt: '2099-01-01T00:00:00.000Z' }));
      await assertFails(engagementsOf(CITIZEN_UID).doc(ENGAGEMENT_ID).delete());
    });
  });
});
