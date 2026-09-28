/**
 * Seeders — **η σύνοψη αγοράς ανά περιοχή** (ADR-890 §5.2): έγγραφο περιοχής × ημέρας + σημάδι εκτέλεσης.
 *
 * 🔑 Κάθε seed είναι **το σχήμα που γράφει ο διακομιστής** (`area-market-rollup.service.ts`), τίποτα
 * περισσότερο. Δεν ανήκει σε μισθωτή: είναι άθροισμα όλης της αγοράς.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-area-market
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';

const SEED_DAY = '2026-09-26';
const SEED_AREA = 'municipality:0701';

async function seed(env: RulesTestEnvironment, collection: string, id: string, data: Record<string, unknown>): Promise<string> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(data);
  });
  return id;
}

export function seedAreaMarketSnapshot(env: RulesTestEnvironment): Promise<string> {
  const emptyOffer = { listings: 0, counted: 0, excluded: { noPrice: 0, noSize: 0, noSegment: 0, implausible: 0 }, segments: {} };
  return seed(env, 'area_market_snapshots', 'amks_seed', {
    schemaVersion: 1, areaId: SEED_AREA, day: SEED_DAY, listingCount: 0, offers: { sale: emptyOffer, rent: emptyOffer },
  });
}

export function seedAreaMarketSeries(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'area_market_series', 'amsr_seed', {
    schemaVersion: 1, areaId: SEED_AREA, points: {}, book: { month: SEED_DAY.slice(0, 7), offers: { sale: {}, rent: {} } },
  });
}

export function seedAreaMarketMap(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'area_market_maps', 'ammp_seed', {
    schemaVersion: 1, day: SEED_DAY, offers: { sale: { [SEED_AREA]: { apartment: [7, 1500] } }, rent: {} },
  });
}

export function seedAreaMarketRun(env: RulesTestEnvironment): Promise<string> {
  return seed(env, 'area_market_runs', 'amkr_seed', {
    schemaVersion: 1, day: SEED_DAY, areas: 1, listings: 1, unassigned: 0, truncated: false, completedAt: `${SEED_DAY}T01:20:00.000Z`,
  });
}
