import 'server-only';

/**
 * @fileoverview Cron: **η παράδοση προσκλήσεων RFQ που δεν πρόλαβε ή δεν πέτυχε το αίτημα** (ADR-923 §5.13 Τ5).
 * @related subapps/procurement/services/rfq-invite-delivery-sweep.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/rfq-invite-delivery.job
 *
 * 🔴 **Το `failed` και το `unknown` είναι το σήμα**: μη μηδενικά = προσκλήσεις που δεν έφτασαν και θέλουν «Επαναποστολή».
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { runRfqInviteDeliverySweep } from '@/subapps/procurement/services/rfq-invite-delivery-sweep';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runRfqInviteDelivery(): Promise<CronJobResult> {
  const report = await runRfqInviteDeliverySweep(getAdminFirestore());
  return {
    summary: `rfq invites: scanned ${report.scanned}, delivered ${report.delivered}, retry later ${report.retryLater}, `
      + `failed ${report.failed}, undeliverable ${report.undeliverable}, unknown ${report.unknown}, skipped ${report.skipped}, `
      + `deferred ${report.deferred}`,
    metrics: { ...report },
  };
}
