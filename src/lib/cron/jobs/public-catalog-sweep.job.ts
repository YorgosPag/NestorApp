import 'server-only';

/**
 * @fileoverview Cron: **το δίχτυ της δημόσιας βιτρίνας καταλόγου** (ADR-923 §5.13 Δ3). Το άδειασμα τρέχει στο `after` της
 * αλλαγής· εδώ ό,τι κόπηκε, τα περάσματα ολόκληρου καταλόγου και οι αλλαγές συνθήκης που δεν αφήνουν γραφή καταλόγου.
 * @module lib/cron/jobs/public-catalog-sweep.job
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepPublicCatalog } from '@/server/catalog/public/public-catalog-sweep.server';
import type { CronJobResult } from '@/types/cron-schedule';

/** Λίγο κάτω από το όριο των 60 s του route: ό,τι μείνει το πιάνει το επόμενο πέρασμα. */
const TIME_BUDGET_MS = 45_000;

export async function runPublicCatalogSweep(): Promise<CronJobResult> {
  const nowMs = Date.now();
  const metrics = await sweepPublicCatalog(getAdminFirestore(), nowMs, nowMs + TIME_BUDGET_MS);

  // 🔴 Πέρασμα που δεν άδειασε τίποτα και απέτυχε δεν είναι επιτυχία: το monitor δεν μένει πράσινο.
  if (metrics.failed > 0 && metrics.drained === 0) {
    throw new Error(`public-catalog-sweep: all ${metrics.failed} drains failed`);
  }

  return {
    summary: `judged ${metrics.judged}, transitions ${metrics.transitions}, unknown ${metrics.unknownCompanies}, drained ${metrics.drained}, deferred ${metrics.deferred}, raced ${metrics.raced}, failed ${metrics.failed}`,
    metrics: { ...metrics },
  };
}
