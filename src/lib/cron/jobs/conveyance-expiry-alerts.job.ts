/**
 * =============================================================================
 * JOB: conveyance-expiry-alerts — **ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΠΟΥ ΛΗΓΟΥΝ** (ADR-901 Φ4 · §6 Σ-5)
 * =============================================================================
 *
 * Πιστοποιητικό που λήγει πριν από το συμβόλαιο ⇒ ο οικοδεσπότης και οι επαγγελματίες της υπόθεσης το μαθαίνουν
 * **πριν** τη μέρα της υπογραφής, και όχι στο γραφείο του συμβολαιογράφου. Μία σύνοψη ανά υπόθεση, **μόνο** όταν
 * αλλάζει το σύνολο (ακμή, όχι στάθμη).
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): εδώ δηλώνεται μόνο **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/conveyance-expiry-alerts.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepConveyanceExpiryAlerts } from '@/services/conveyance/conveyance-expiry-alerts.server';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runConveyanceExpiryAlerts(): Promise<CronJobResult> {
  const report = await sweepConveyanceExpiryAlerts(getAdminFirestore(), Date.now());
  return {
    summary:
      `considered ${report.considered}, notified ${report.notified}, skipped ${report.skipped}, failed ${report.failed}`
      + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      notified: report.notified,
      skipped: report.skipped,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
