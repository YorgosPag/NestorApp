/**
 * Seeders — **οι προβολές αγγελίας** (ADR-777 §8.72): αλάτι · σημάδι · shard · σύνοψη.
 *
 * 🔑 **Χωριστό αρχείο**: δεν ανήκουν σε μισθωτή — είναι μηχανισμός μέτρησης της πλατφόρμας. Κάθε
 * seed είναι **το σχήμα που γράφει ο διακομιστής** (`listing-view-recorder` · `listing-stats-rollup`),
 * τίποτα περισσότερο.
 *
 * ⚠️ Το ακίνητο ανήκει στον `external_user` — τον ιδιώτη κάτοχο της Α14. Έτσι η άρνηση στις άγκυρες
 * είναι άρνηση **προς τον ίδιο τον κάτοχο**, όχι «δεν αφορά αυτόν τον persona».
 *
 * @module tests/firestore-rules/_harness/seed-helpers-listing-stats
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';

export const SEED_LISTING_ID = 'ownp_seed_0001';
const SEED_DAY = '2026-09-24';

async function seed(env: RulesTestEnvironment, collection: string, id: string, data: Record<string, unknown>): Promise<string> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(data);
  });
  return id;
}

export function seedListingViewSalt(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'listing_view_salts', 'lvsl_seed', { day: SEED_DAY, salt: 'f'.repeat(64) });
}

export function seedListingViewMark(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'listing_view_marks', 'lvmk_seed', { day: SEED_DAY });
}

export function seedListingViewShard(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'listing_view_shards', 'lvsh_seed', { propertyId: SEED_LISTING_ID, day: SEED_DAY, shard: 0, views: 3 });
}

export function seedListingStats(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'listing_stats', 'lsta_seed', {
    propertyId: SEED_LISTING_ID, daily: { [SEED_DAY]: 3 }, archivedViews: 0, rolledThrough: SEED_DAY,
  });
}
