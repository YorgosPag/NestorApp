/**
 * Firestore Rules — συλλογή `mandate_requests` (ADR-827 §8.7)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** περνούν
 * από τον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΛΙ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ΕΙΝΑΙ ΤΟΥ **ΠΑΡΑΛΗΠΤΗ** — ΚΑΙ Ο ΠΙΝΑΚΑΣ ΔΕΝ ΤΟ ΛΕΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `denyAllMatrix` αρνείται σε **όλους**, οπότε το κελί `same_tenant_admin × read`
 * περνά **ούτως ή άλλως**. Αλλά ο `same_tenant_admin` είναι απλώς «διαχειριστής του
 * company-a»: αν κανένα σπαρμένο έγγραφο δεν **απευθύνεται** στο `company-a`, τότε η
 * μετάλλαξη
 *
 *     allow read: if resource.data.agencyCompanyId == getUserCompanyId();
 *
 * — δηλαδή ακριβώς το «λογικό» χαλάρωμα που θα σκεφτόταν ο επόμενος, *«μα το γραφείο
 * πρέπει να δει τα εισερχόμενά του!»* — **ΔΕΝ θα κοκκίνιζε**. Πράσινο που σημαίνει
 * «κανείς δεν κοίταξε».
 *
 * ⇒ Γι' αυτό η σουίτα **σπέρνει αίτημα προς το `company-a`** και προσθέτει ρητή άγκυρα.
 *
 * 🔑 **Γιατί ο παραλήπτης ΔΕΝ διαβάζει**: το έγγραφο περιέχει `requestedByUserId`, και
 * η τεκμηρίωση της Google λέει *«you either retrieve the full document, or you retrieve
 * nothing… it is impossible using security rules alone to prevent users from reading
 * specific fields»*. Το γραφείο κρίνει το **ΑΚΙΝΗΤΟ** (§8.2)· παίρνει
 * `MandateRequestForAgency`, σχήμα **χωρίς πεδίο ταυτότητας καθόλου**.
 *
 * @since 2026-08-29 (ADR-827 Φάση Β)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedMandateRequest } from '../_harness/seed-helpers-mandate';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'mandate_requests',
)!;

describe('mandate_requests.rules — το αίτημα ανήκει στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  // ==========================================================================
  // Η ΑΓΚΥΡΑ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΙΝΑΚΑΣ PERSONAS
  // ==========================================================================

  describe('🔴 ούτε το ΙΔΙΟ ΤΟ ΓΡΑΦΕΙΟ στο οποίο απευθύνεται', () => {
    const REQUEST_ID = 'mreq_anchor_0001';

    it('ο παραλήπτης (agencyCompanyId === το δικό του) ΔΕΝ διαβάζει το έγγραφο', async () => {
      await seedMandateRequest(env(), REQUEST_ID, SAME_TENANT_COMPANY_ID);

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient.firestore().collection('mandate_requests').doc(REQUEST_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα φιλτραρισμένο στο δικό του γραφείο — η λίστα είναι η ίδια διαρροή', async () => {
      await seedMandateRequest(env(), REQUEST_ID, SAME_TENANT_COMPANY_ID);

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient
          .firestore()
          .collection('mandate_requests')
          .where('agencyCompanyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('ούτε ο ΙΔΙΩΤΗΣ που το έγραψε — η οθόνη του ρωτά `disclosedTo`, όχι το έγγραφο', async () => {
      await seedMandateRequest(env(), REQUEST_ID, SAME_TENANT_COMPANY_ID);

      // Ο ιδιώτης δεν είναι μισθωτής· ο πλησιέστερος persona είναι ο εξωτερικός.
      const owner = getContext(env(), 'external_user');

      await assertFails(
        owner.firestore().collection('mandate_requests').doc(REQUEST_ID).get(),
      );
    });
  });
});
