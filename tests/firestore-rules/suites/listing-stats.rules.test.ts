/**
 * Firestore Rules — συλλογή `listing_stats` (ADR-777 §8.72)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **Ο ΠΕΙΡΑΣΜΟΣ ΕΙΝΑΙ ΙΔΙΟΚΤΗΣΙΑΚΟΣ**: *«μα είναι οι προβολές του ΔΙΚΟΥ ΤΟΥ σπιτιού!»*. Κι όμως, ο
 * κάτοχος διαβάζει **προβολή** από το `/api/owner-properties/stats`: η σύνοψη δεν φέρει κάτοχο, άρα
 * κανόνας ανάγνωσης θα έπρεπε να την αφήσει ανοιχτή σε **όλους** — ή να γράψει δεύτερο αντίγραφο της
 * θεματοφυλακής μέσα στο έγγραφο. Και **γραφή** πελάτη θα ήταν φούσκωμα προβολών με ένα κλικ.
 *
 * @since 2026-09-23 (ADR-777 §8.72)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { seedListingStats } from '../_harness/seed-helpers-listing-stats';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'listing_stats')!;

describe('listing_stats.rules — η σύνοψη προβολών τη γράφει μόνο το cron', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο ΙΔΙΟΣ Ο ΚΑΤΟΧΟΣ του ακινήτου', () => {
    it('ΔΕΝ διαβάζει τη σύνοψη του δικού του ακινήτου', async () => {
      const id = await seedListingStats(env());
      const owner = getContext(env(), 'external_user');
      await assertFails(owner.firestore().collection('listing_stats').doc(id).get());
    });

    it('🔴 ΔΕΝ φουσκώνει τις προβολές του', async () => {
      const id = await seedListingStats(env());
      const owner = getContext(env(), 'external_user');
      await assertFails(owner.firestore().collection('listing_stats').doc(id).update({ archivedViews: 10_000 }));
    });
  });
});
