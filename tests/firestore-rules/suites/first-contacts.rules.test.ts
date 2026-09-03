/**
 * Firestore Rules — συλλογή `first_contacts` (ADR-843)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** περνούν
 * από τον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΔΩ Η ΑΠΟΚΑΛΥΨΗ ΕΙΝΑΙ Ο ΣΚΟΠΟΣ — ΚΑΙ Ο ΚΑΝΟΝΑΣ ΠΑΡ' ΟΛΑ ΑΥΤΑ ΑΡΝΕΙΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο `mandate_requests` το `deny_all` ήταν **προφανές**: κρύβαμε το πρόσωπο. Εδώ
 * είναι **αντι-διαισθητικό**, και γι' αυτό η σουίτα οφείλει να το αποδείξει αντί να το
 * δηλώσει: η πράξη **υπάρχει για να μάθει ο άλλος ποιος είσαι**. Ο επόμενος που θα
 * διαβάσει τον κανόνα θα σκεφτεί, εύλογα, *«μα τότε γιατί δεν τον αφήνουμε να τον
 * διαβάσει;»* — και θα έχει **δύο** διαφορετικές, λογικές ιδέες.
 *
 * ⚠️ **Ο `denyAllMatrix` ΔΕΝ πιάνει καμία από τις δύο.** Αρνείται σε όλους, άρα κάθε
 * κελί περνά **ούτως ή άλλως** — ακόμη κι αν ο κανόνας χαλαρώσει, αρκεί κανένα
 * σπαρμένο έγγραφο να μην **αφορά** τον δοκιμαζόμενο. Γι' αυτό υπάρχουν οι δύο άγκυρες
 * παρακάτω, και γι' αυτό ο seeder γράφει `seekerUserId` **ίσο με persona που μπορούμε
 * να υποδυθούμε**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΤΡΕΙΣ ΛΟΓΟΙ ΤΗΣ ΑΡΝΗΣΗΣ — και ο τρίτος δεν υπάρχει στο `mreq`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Το ωμό έγγραφο λέει περισσότερα από την πράξη**: `demandId` *(κλειδί προς το
 *    επίπεδο Β — SPEC-777A §12.7(α): «καμία διαδρομή που να το κάνει εργαλείο
 *    πίεσης»)* και `matchReason`. *«You either retrieve the full document, or you
 *    retrieve nothing.»*
 * 2. **Η αποκάλυψη υπολογίζεται** (`disclosedToOfferer`), και οφείλει να τρέχει στην
 *    ίδια πλευρά με τον συνθέτη της προβολής — αλλιώς δύο πηγές για το «τι είδε ο
 *    άλλος», που στο ΠΕ6/Κ10 λέγεται **ψευδής διαβεβαίωση**.
 * 3. 🔴 **Η ΧΩΡΗΤΙΚΟΤΗΤΑ** (ΠΕ5): το όριο κρίνεται **μετρώντας τις υπάρχουσες**.
 *    Πελάτης που γράφει θα έγραφε την ενδέκατη **παράλληλα** με τη δέκατη — ο έλεγχος
 *    θα έτρεχε δύο φορές πάνω στην ίδια κατάσταση και θα περνούσε δύο φορές. Κανόνας
 *    **δεν μπορεί** να μετρήσει έγγραφα, άρα ο γραφέας πρέπει να είναι **ένας**.
 *
 * @since 2026-09-03 (ADR-843 Στάδιο Α)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { SEED_SEEKER_UID, seedFirstContact } from '../_harness/seed-helpers-contact';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'first_contacts',
)!;

describe('first_contacts.rules — η πράξη ανήκει στον διακομιστή, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  // ==========================================================================
  // ΑΓΚΥΡΑ 1 — Ο ΙΔΙΟΣ Ο ΖΗΤΩΝ. «Μα είναι η ΔΙΚΗ ΤΟΥ πράξη.»
  // ==========================================================================

  describe('🔴 ούτε ο ΙΔΙΟΣ Ο ΖΗΤΩΝ που την έκανε', () => {
    const CONTACT_ID = 'fcon_anchor_0001';

    it('ο συγγραφέας (seekerUserId === το δικό του uid) ΔΕΝ διαβάζει το έγγραφο', async () => {
      await seedFirstContact(env(), CONTACT_ID);

      // Ο ιδιώτης δεν είναι μισθωτής· ο πλησιέστερος persona είναι ο εξωτερικός —
      // και ο seeder έγραψε ΤΟ ΔΙΚΟ ΤΟΥ uid, ώστε η άρνηση να μην είναι για λάθος λόγο.
      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker.firestore().collection('first_contacts').doc(CONTACT_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα φιλτραρισμένο στον εαυτό του — «οι πράξεις μου» είναι η ίδια διαρροή', async () => {
      await seedFirstContact(env(), CONTACT_ID);

      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker
          .firestore()
          .collection('first_contacts')
          .where('seekerUserId', '==', SEED_SEEKER_UID)
          .get(),
      );
    });

    it('ούτε γράφει ο ίδιος — η ΧΩΡΗΤΙΚΟΤΗΤΑ (ΠΕ5) κρίνεται μετρώντας, και κανόνας δεν μετρά', async () => {
      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker.firestore().collection('first_contacts').doc('fcon_anchor_0002').set({
          id: 'fcon_anchor_0002',
          seekerUserId: SEED_SEEKER_UID,
          target: { kind: 'professional', agencyCompanyId: SAME_TENANT_COMPANY_ID },
          demandId: null,
          disclosure: {
            displayName: 'Ελένη Π.',
            email: 'eleni@example.gr',
            phone: null,
            acceptsPlatformMessages: false,
          },
          matchReason: null,
          lifecycle: 'open',
          createdAt: '2026-09-03T11:00:00.000Z',
          withdrawnAt: null,
          seenAt: null,
        }),
      );
    });

    it('ούτε ΑΠΟΣΥΡΕΙ μόνος του — το ΠΕ6 είναι μετάβαση που περνά από τον διακομιστή', async () => {
      await seedFirstContact(env(), CONTACT_ID);

      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker
          .firestore()
          .collection('first_contacts')
          .doc(CONTACT_ID)
          .update({ lifecycle: 'withdrawn', withdrawnAt: '2026-09-04T09:00:00.000Z' }),
      );
    });

    it('🔑 ούτε ΔΙΑΓΡΑΦΕΙ — «ανακαλείται η ΣΧΕΣΗ, ποτέ η ΙΣΤΟΡΙΑ» (ΠΕ6)', async () => {
      await seedFirstContact(env(), CONTACT_ID);

      // Το ίχνος ΔΕΝ είναι δικό μας, είναι ΤΩΝ ΔΥΟ: αν αύριο ο ένας πει «με
      // παρενόχλησε» ή ο άλλος «συμφωνήσαμε και το αρνήθηκε», το σβήσιμο αφήνει
      // ΚΑΙ ΤΟΥΣ ΔΥΟ χωρίς τίποτα να δείξουν.
      const seeker = getContext(env(), 'external_user');

      await assertFails(
        seeker.firestore().collection('first_contacts').doc(CONTACT_ID).delete(),
      );
    });
  });

  // ==========================================================================
  // ΑΓΚΥΡΑ 2 — Ο ΠΑΡΑΛΗΠΤΗΣ. «Μα είναι τα ΕΙΣΕΡΧΟΜΕΝΑ ΜΟΥ.»
  // ==========================================================================

  describe('🔴 ούτε ο ΠΑΡΑΛΗΠΤΗΣ στον οποίο απευθύνεται η πράξη', () => {
    const CONTACT_ID = 'fcon_anchor_0003';

    it('ο επαγγελματίας-στόχος (agencyCompanyId === το δικό του) ΔΕΝ διαβάζει το έγγραφο', async () => {
      await seedFirstContact(env(), CONTACT_ID, {
        kind: 'professional',
        agencyCompanyId: SAME_TENANT_COMPANY_ID,
      });

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient.firestore().collection('first_contacts').doc(CONTACT_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα στα «εισερχόμενά του» — και εδώ ζει το `demandId`, κλειδί προς το επίπεδο Β', async () => {
      await seedFirstContact(env(), CONTACT_ID, {
        kind: 'professional',
        agencyCompanyId: SAME_TENANT_COMPANY_ID,
      });

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient
          .firestore()
          .collection('first_contacts')
          .where('target.agencyCompanyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('ούτε σημειώνει ότι «το είδε» — το `seenAt` είναι ο πυρήνας του Κ10, όχι μετρική', async () => {
      await seedFirstContact(env(), CONTACT_ID, {
        kind: 'professional',
        agencyCompanyId: SAME_TENANT_COMPANY_ID,
      });

      const recipient = getContext(env(), 'same_tenant_admin');

      await assertFails(
        recipient
          .firestore()
          .collection('first_contacts')
          .doc(CONTACT_ID)
          .update({ seenAt: '2026-09-03T12:00:00.000Z' }),
      );
    });
  });
});
