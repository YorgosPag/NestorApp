/**
 * Seeders — **η αποθήκευση αγγελίας** (ADR-777 §8.74).
 *
 * 🔑 Το seed είναι **το σχήμα που γράφει ο διακομιστής** (`saved-listing.service.ts`), τίποτα
 * περισσότερο. Ο αποθηκεύων είναι ο `external_user`, ώστε η άρνηση στις άγκυρες να είναι άρνηση
 * **προς τον ίδιο** — όχι «δεν αφορά αυτόν τον persona».
 *
 * @module tests/firestore-rules/_harness/seed-helpers-saved-listing
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { PERSONA_CLAIMS } from '../_registry/personas';
import { withSeedContext } from './auth-contexts';
import { SEED_LISTING_ID } from './seed-helpers-listing-stats';

export const SEED_SAVER_UID = PERSONA_CLAIMS.external_user.uid;
export const SEED_SAVED_LISTING_ID = 'svls_seed';

export async function seedSavedListing(env: RulesTestEnvironment): Promise<string> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('saved_listings').doc(SEED_SAVED_LISTING_ID).set({
      id: SEED_SAVED_LISTING_ID,
      saverUserId: SEED_SAVER_UID,
      listingId: SEED_LISTING_ID,
      savedAt: '2026-09-24T10:00:00.000Z',
      priceAtSave: { amount: 150_000, role: 'sale' },
    });
  });
  return SEED_SAVED_LISTING_ID;
}
