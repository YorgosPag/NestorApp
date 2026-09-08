/**
 * Firestore Rules — συλλογή `showcase_mark_sources` (ADR-841 §7 Α21.12)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** ανήκουν
 * αποκλειστικά στον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ **ΙΔΙΟΚΤΗΤΗ** — ΚΑΙ Ο ΠΙΝΑΚΑΣ ΔΕΝ ΤΟ ΛΕΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `denyAllMatrix` αρνείται σε **όλους**, οπότε το κελί `same_tenant_admin × read`
 * περνά **ούτως ή άλλως**. Αλλά αν κανένα σπαρμένο έγγραφο δεν ανήκει στο `company-a`,
 * τότε η μετάλλαξη
 *
 *     allow read: if companyId == getUserCompanyId();
 *
 * — δηλαδή ακριβώς το «λογικό» χαλάρωμα που θα σκεφτόταν ο επόμενος, *«μα είναι το ΔΙΚΟ
 * του σήμα, γιατί να μη δει πού είναι;»* — **ΔΕΝ θα κοκκίνιζε**. Πράσινο που σημαίνει
 * «κανείς δεν κοίταξε».
 *
 * ⇒ Γι' αυτό η σουίτα **σπέρνει εγγραφή που ανήκει στον ίδιο** και προσθέτει ρητές
 * άγκυρες, **και για τις δύο** πλευρές.
 *
 * 🔑 **Γιατί ούτε ο ιδιοκτήτης διαβάζει**: το έγγραφο κρατά `privateStoragePath`,
 * δηλαδή τη μορφή `companies/{id}/entities/{fileId}/…`. Το Firestore **δεν φιλτράρει
 * πεδία** — *«you either retrieve the full document, or you retrieve nothing»*. Και το
 * `showcase-mark-custody` έχει ήδη αποφασίσει γραπτώς ότι αυτό το μονοπάτι **δεν
 * επιστρέφει ποτέ** στο σύρμα. Ένα `read: if true` εδώ θα ήταν η **ίδια** διαρροή από
 * άλλη πόρτα.
 *
 * 🔴 **Γιατί ούτε ΓΡΑΦΕΙ**: το μονοπάτι είναι **απόδειξη προέλευσης** που θα διαβάσει η
 * μαζική επαναδημοσίευση. Πελάτης που το γράφει θα έδειχνε σε **ξένο** αρχείο, και η
 * επόμενη σάρωση θα το δημοσίευε ως σήμα του — δηλαδή ο φρουρός κατοχής
 * (`markSourceForCompany`) θα παρακάμπτονταν **αναδρομικά**, χωρίς κανένα αίτημα να
 * έχει περάσει ποτέ από αυτόν.
 *
 * @since 2026-09-08 (ADR-841 §7 Α21.12)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedShowcaseMarkSource } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'showcase_mark_sources',
)!;

describe('showcase_mark_sources.rules — η προέλευση ανήκει στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  // ==========================================================================
  // ΟΙ ΑΓΚΥΡΕΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΙΝΑΚΑΣ PERSONAS
  // ==========================================================================

  describe('🔴 ούτε ο ΙΔΙΟΣ ο κάτοχος του σήματος', () => {
    it('ο ιδιοκτήτης (companyId === το δικό του) ΔΕΝ διαβάζει τη διαδρομή του πρωτοτύπου', async () => {
      await seedShowcaseMarkSource(env(), SAME_TENANT_COMPANY_ID);

      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner.firestore().collection('showcase_mark_sources').doc(SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα φιλτραρισμένο στο δικό του — η λίστα είναι η ίδια διαρροή', async () => {
      await seedShowcaseMarkSource(env(), SAME_TENANT_COMPANY_ID);

      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection('showcase_mark_sources')
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('🔴 ούτε ΓΡΑΦΕΙ τη δική του — αλλιώς δείχνει σε ΞΕΝΟ αρχείο και το δημοσιεύει', async () => {
      // Ο φρουρός κατοχής ζει στον γραφέα (`markSourceForCompany`), με ταυτότητα **από
      // την απόδειξη**. Αν ο πελάτης μπορούσε να γράψει εδώ, θα τον παρέκαμπτε
      // **αναδρομικά**: η επόμενη μαζική επαναδημοσίευση θα διάβαζε το μονοπάτι που
      // έγραψε ο ίδιος, χωρίς να το έχει κρίνει κανείς.
      const owner = getContext(env(), 'same_tenant_admin');

      await assertFails(
        owner
          .firestore()
          .collection('showcase_mark_sources')
          .doc(SAME_TENANT_COMPANY_ID)
          .set({
            companyId: SAME_TENANT_COMPANY_ID,
            kind: 'logo',
            privateStoragePath: 'companies/company-XENH/entities/file_klopi/mark.png',
            recordedAt: '2026-09-08T09:00:00.000Z',
          }),
      );
    });
  });
});
