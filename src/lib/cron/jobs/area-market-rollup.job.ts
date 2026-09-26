import 'server-only';

/**
 * @fileoverview Cron: **η νυχτερινή σύνοψη ζητούμενων τιμών ανά περιοχή** (ADR-890 §5.2).
 * @related services/market/area-market-rollup.service.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/area-market-rollup.job
 *
 * ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο** — η υπηρεσία παίρνει την ημέρα αγοράς ως όρισμα.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { rollupAreaMarket } from '@/services/market/area-market-rollup.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runAreaMarketRollup(): Promise<CronJobResult> {
  const now = new Date();
  const run = await rollupAreaMarket(getAdminFirestore(), marketDayOf(now.getTime()), now);

  return {
    summary:
      `day ${run.day}: areas ${run.areas}, listings ${run.listings}, unassigned ${run.unassigned}`
      + (run.truncated ? ' (TRUNCATED)' : ''),
    metrics: {
      areas: run.areas,
      listings: run.listings,
      unassigned: run.unassigned,
    },
  };
}
