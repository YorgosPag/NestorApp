import 'server-only';

/**
 * @fileoverview Cron: **η βραδινή συμφιλίωση των παραδόσεων φακέλου** (ADR-916 §5.4).
 * @related services/property-handover/property-handover-reconcile.service.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/property-handover-reconcile.job
 *
 * 🔴 **Το `changed` είναι ο λόγος ύπαρξής της**: με κάθε σημείο κλήσης στη θέση του είναι **μηδέν**. Μη
 * μηδενικό = πόρτα που ξέφυγε (π.χ. νέος γραφέας πώλησης χωρίς κλήση) — φαίνεται στα μεγέθη της εκτέλεσης.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { reconcilePropertyHandovers } from '@/services/property-handover/property-handover-reconcile.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runPropertyHandoverReconcile(): Promise<CronJobResult> {
  const report = await reconcilePropertyHandovers(getAdminFirestore());
  return {
    summary: `handovers: scanned ${report.scanned}, changed ${report.changed}, invitations ${report.invitationChanged}, failed ${report.failed}`,
    metrics: { ...report },
  };
}
