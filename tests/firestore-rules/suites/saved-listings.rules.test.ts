/**
 * Firestore Rules — συλλογή `saved_listings` (ADR-777 §8.74)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **ΔΥΟ ΠΕΙΡΑΣΜΟΙ, ΚΑΙ ΟΙ ΔΥΟ «ΛΟΓΙΚΟΙ»:**
 * 1. *«μα είναι η ΔΙΚΗ ΤΟΥ λίστα!»* — η λίστα είναι **προβολή** του διακομιστή (μαζί με την τρέχουσα
 *    κατάσταση της αγγελίας). Γραφή πελάτη θα παρέκαμπτε το «στην αγορά;» και το «δική σου;».
 * 2. *«ο κάτοχος να δει ποιοι κράτησαν την αγγελία του»* — βλέπει **πλήθος**, ποτέ ταυτότητες.
 *
 * @since 2026-09-24 (ADR-777 §8.74)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { SEED_LISTING_ID } from '../_harness/seed-helpers-listing-stats';
import { seedSavedListing, SEED_SAVER_UID } from '../_harness/seed-helpers-saved-listing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'saved_listings')!;

describe('saved_listings.rules — την αποθήκευση τη γράφει μόνο ο διακομιστής', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε Ο ΙΔΙΟΣ ο αποθηκεύων', () => {
    it('ΔΕΝ διαβάζει το έγγραφο της δικής του αποθήκευσης', async () => {
      const id = await seedSavedListing(env());
      const saver = getContext(env(), 'external_user');
      await assertFails(saver.firestore().collection('saved_listings').doc(id).get());
    });

    it('🔴 ΔΕΝ γράφει μόνος του αποθήκευση (παράκαμψη του «στην αγορά;» / «δική σου;»)', async () => {
      const saver = getContext(env(), 'external_user');
      await assertFails(
        saver.firestore().collection('saved_listings').doc('svls_forged').set({
          saverUserId: SEED_SAVER_UID,
          listingId: SEED_LISTING_ID,
          savedAt: '2026-09-24T10:00:00.000Z',
          priceAtSave: null,
        }),
      );
    });
  });

  describe('🔴 κανείς δεν ρωτά «ΠΟΙΟΙ κράτησαν αυτή την αγγελία;»', () => {
    it('ερώτημα ανά listingId απορρίπτεται', async () => {
      await seedSavedListing(env());
      const someone = getContext(env(), 'external_user');
      await assertFails(
        someone.firestore().collection('saved_listings').where('listingId', '==', SEED_LISTING_ID).get(),
      );
    });
  });
});
