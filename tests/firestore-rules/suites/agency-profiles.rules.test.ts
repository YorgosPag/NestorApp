/**
 * Firestore Rules — συλλογή `agency_profiles` (ADR-827 §9)
 *
 * Σχήμα κανόνα: `read: if true` · `write: if false` — ίδιο με το `public_listings`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΙΔΙΟΣ ΠΙΝΑΚΑΣ, ΑΝΤΙΣΤΡΟΦΟ ΕΡΩΤΗΜΑ — ΓΙ' ΑΥΤΟ ΞΕΧΩΡΙΣΤΗ ΣΟΥΙΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο `public_listings` το ερώτημα είναι *«διαρρέει ταυτότητα ΠΕΛΑΤΗ;»*. **Εδώ η
 * ταυτότητα του ΟΡΓΑΝΙΣΜΟΥ είναι το περιεχόμενο** — είναι ο λόγος ύπαρξης του
 * εγγράφου. Άρα το ερώτημα αντιστρέφεται σε **τρία**:
 *
 *   1. διαρρέει **πρόσωπο** *(ο μεσίτης με ατομική επιχείρηση ΕΙΝΑΙ φυσικό πρόσωπο —
 *      GDPR αιτ. σκ. 14 δεν τον καλύπτει)*;
 *   2. διαρρέει **εμπορική τιμή** που θα επέτρεπε κατάταξη γραφείων *(NAR $418M: ο
 *      κατάλογος ΓΡΑΦΕΙΩΝ είναι μεγαλύτερη επιφάνεια steering από τον κατάλογο
 *      ΑΚΙΝΗΤΩΝ)*;
 *   3. διαρρέει **κανάλι**, που θα παρέκαμπτε τη γραπτή πράξη του άρθρου 200 §1;
 *
 * ⚠️ **Ένας πίνακας personas απαντά «ο ανώνυμος διαβάζει» και στα δύο αρχεία** —
 * δηλαδή θα ήταν πράσινος πάνω και στις τρεις διαρροές. Γι' αυτό η σουίτα δεν αρκείται
 * σε αυτόν.
 *
 * @since 2026-08-29 (ADR-827 Φάση Β)
 */

import { assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { seedAgencyProfile } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'agency_profiles',
)!;

/**
 * **Ό,τι ΔΕΝ επιτρέπεται να φύγει ποτέ από αυτό το σχήμα**, ανά λόγο.
 *
 * 🔑 Γραμμένο ως **κλειστός κατάλογος με αιτία**, όχι ως σκόρπια `expect`: ο επόμενος
 * που θα μπει να προσθέσει `rating` οφείλει να δει **γιατί** δεν υπάρχει.
 */
const FORBIDDEN_FIELDS = [
  // 1. Antitrust (§9.9 α) — πεδίο που δεν υπάρχει δεν μπορεί να ταξινομήσει κανείς.
  'commission',
  'commissionPercentage',
  'fee',
  'rating',
  'score',
  'rank',
  'featured',
  'promoted',
  // 2. Το προφίλ είναι ΚΟΥΜΠΙ, όχι κατάλογος τηλεφώνων (§9.8) — άρθρο 200 §1.
  'phone',
  'phoneNumber',
  'email',
  'address',
  'website',
  // 3. GDPR: ο μεσίτης με ατομική επιχείρηση ΕΙΝΑΙ φυσικό πρόσωπο (§9.9 β).
  'legalRepresentativeName',
  'ownerName',
  'contactPerson',
] as const;

describe('agency_profiles.rules — η βιτρίνα που ΔΕΝ απαριθμεί μισθωτές (ADR-827 §9)', () => {
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
        await seedAgencyProfile(env, SAME_TENANT_COMPANY_ID);

        const ctx = getContext(env, cell.persona);

        const target: AssertTarget = {
          collection: 'agency_profiles',
          docId: SAME_TENANT_COMPANY_ID,
          data: { displayName: 'ΔΟΚΙΜΗ ΕΓΓΡΑΦΗΣ' },
          createData: {
            companyId: 'company-b',
            alias: 'allo-grafeio',
            displayName: 'ΑΛΛΟ ΓΡΑΦΕΙΟ',
            gemiNumber: '987654321000',
            place: null,
            publishedAt: '2026-08-29T10:00:00.000Z',
          },
          // ⚠️ ΚΑΝΕΝΑ listFilter: η αφιλτράριστη σάρωση ΕΙΝΑΙ το ερώτημα του καταλόγου,
          //    και είναι ακριβώς αυτό που επιτρέπεται εδώ — επειδή ο ΠΛΗΘΥΣΜΟΣ είναι
          //    opt-in, όχι επειδή το σχήμα είναι κλειστό (§9.4).
        };

        await assertCell(ctx, cell, target);
      });
    });
  }

  // ==========================================================================
  // ΟΙ ΑΓΚΥΡΕΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΙΝΑΚΑΣ PERSONAS
  // ==========================================================================

  describe('🔴 το έγγραφο που φτάνει στον ΑΝΩΝΥΜΟ δεν φέρει τιμή, κανάλι ή πρόσωπο', () => {
    it('κανένα από τα απαγορευμένα πεδία δεν υπάρχει στο έγγραφο', async () => {
      await seedAgencyProfile(env, SAME_TENANT_COMPANY_ID);

      const anon = env.unauthenticatedContext();
      const snap = await assertSucceeds(
        anon.firestore().collection('agency_profiles').doc(SAME_TENANT_COMPANY_ID).get(),
      );

      const keys = Object.keys(snap.data() ?? {});
      for (const field of FORBIDDEN_FIELDS) {
        expect(keys).not.toContain(field);
      }
    });

    it('🔑 και στη ΣΑΡΩΣΗ — ο κατάλογος είναι το ερώτημα που πράγματι στέλνει η οθόνη', async () => {
      await seedAgencyProfile(env, SAME_TENANT_COMPANY_ID);

      const anon = env.unauthenticatedContext();
      const snap = await assertSucceeds(
        anon.firestore().collection('agency_profiles').get(),
      );

      expect(snap.size).toBe(1);
      for (const doc of snap.docs) {
        const serialized = JSON.stringify(doc.data());
        for (const field of FORBIDDEN_FIELDS) {
          expect(serialized).not.toContain(field);
        }
      }
    });
  });

  describe('🔑 Η ΑΠΟΥΣΙΑ ΕΙΝΑΙ ΑΔΙΑΚΡΙΤΗ ΑΠΟ ΤΗΝ ΑΝΥΠΑΡΞΙΑ (§9.4)', () => {
    it('γραφείο που ΔΕΝ δημοσιεύτηκε απαντά ταυτόσημα με χώρο που δεν υπήρξε ποτέ', async () => {
      // Δημοσιευμένο: το `company-a`. Το `company-b` **υπάρχει ως μισθωτής** στους
      // personas (`cross_tenant_admin`) και **δεν** έχει δημοσιεύσει βιτρίνα.
      await seedAgencyProfile(env, SAME_TENANT_COMPANY_ID);

      const anon = env.unauthenticatedContext();
      const col = anon.firestore().collection('agency_profiles');

      const existingTenant = await assertSucceeds(col.doc('company-b').get());
      const neverExisted = await assertSucceeds(col.doc('comp_pote_den_yprxe').get());

      // 🔴 Η ΙΣΟΤΗΤΑ ΕΙΝΑΙ Η ΕΓΓΥΗΣΗ: αν οι δύο απαντήσεις μπορούσαν να διαφέρουν, η
      //    διεύθυνση θα γινόταν όργανο απαρίθμησης (ADR-787 Ε-5 §4 #1).
      expect(existingTenant.exists).toBe(false);
      expect(neverExisted.exists).toBe(false);
    });

    it('και η σάρωση δεν επιστρέφει τον αδημοσίευτο μισθωτή', async () => {
      await seedAgencyProfile(env, SAME_TENANT_COMPANY_ID);

      const anon = env.unauthenticatedContext();
      const snap = await assertSucceeds(
        anon.firestore().collection('agency_profiles').get(),
      );

      const ids = snap.docs.map((d) => d.id);
      expect(ids).toEqual([SAME_TENANT_COMPANY_ID]);
      expect(ids).not.toContain('company-b');
    });
  });
});
