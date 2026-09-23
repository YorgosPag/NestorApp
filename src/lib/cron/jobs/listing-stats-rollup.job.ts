import 'server-only';

/**
 * @fileoverview Cron: **η νυχτερινή σύνοψη προβολών αγγελίας** (ADR-777 §8.72).
 * @related services/listings/listing-stats-rollup.service.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/listing-stats-rollup.job
 *
 * ⚠️ Το ρολόι διαβάζεται **εδώ, στο σύνορο** — η υπηρεσία παίρνει την ημέρα αγοράς ως όρισμα.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { rollupListingStats } from '@/services/listings/listing-stats-rollup.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runListingStatsRollup(): Promise<CronJobResult> {
  const report = await rollupListingStats(getAdminFirestore(), marketDayOf(Date.now()));

  return {
    summary:
      `days ${report.days.join(',')}: properties ${report.properties}, failed ${report.failed}, `
      + `salts deleted ${report.saltsDeleted}`,
    metrics: {
      properties: report.properties,
      failed: report.failed,
      saltsDeleted: report.saltsDeleted,
    },
  };
}
