/**
 * Firestore Rules — συλλογή `listing_view_shards` (ADR-777 §8.72)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false`.
 *
 * 🔴 **Το κελί που έχει σημασία είναι η ΓΡΑΦΗ ΤΟΥ ΑΝΩΝΥΜΟΥ**: η σελίδα αγγελίας είναι δημόσια, και
 * ένα «αφού ο επισκέπτης μετράει, ας γράφει ο ίδιος το shard» θα έσβηνε με μία κίνηση **και** τον
 * αποδυπλασιασμό **και** τον αποκλεισμό του κατόχου. Η μέτρηση περνά **μόνο** από τον γραφέα.
 *
 * @since 2026-09-23 (ADR-777 §8.72)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext } from '../_harness/auth-contexts';
import { SEED_LISTING_ID, seedListingViewShard } from '../_harness/seed-helpers-listing-stats';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'listing_view_shards')!;

describe('listing_view_shards.rules — ο ζεστός μετρητής ανήκει στον γραφέα προβολών', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 κανείς δεν μετρά μόνος του', () => {
    it('ο ανώνυμος επισκέπτης ΔΕΝ γράφει shard', async () => {
      const anonymous = getContext(env(), 'anonymous');
      await assertFails(anonymous.firestore().collection('listing_view_shards').doc('lvsh_forged').set({
        propertyId: SEED_LISTING_ID, day: '2026-09-24', shard: 0, views: 500,
      }));
    });

    it('ο κάτοχος ΔΕΝ διαβάζει τα σημερινά shards του', async () => {
      const id = await seedListingViewShard(env());
      const owner = getContext(env(), 'external_user');
      await assertFails(owner.firestore().collection('listing_view_shards').doc(id).get());
    });
  });
});
