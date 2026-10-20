import 'server-only';

/**
 * @fileoverview Cron: **η παράδοση αρχείων στον φάκελο του αγοραστή, ό,τι δεν πρόλαβε το αίτημα** (ADR-916 Φ-Γ1).
 * @related services/property-handover/property-handover-delivery-queue.service.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/property-handover-delivery.job
 *
 * 🔴 **Το `failedHandovers` είναι το σήμα**: μη μηδενικό = παράδοση που δεν μπορεί να προχωρήσει (π.χ. ο φάκελος άλλαξε
 * χέρια) — φαίνεται στα μεγέθη της εκτέλεσης, και ο λόγος στο ημερολόγιο.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { runPropertyHandoverDeliveryQueue } from '@/services/property-handover/property-handover-delivery-queue.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runPropertyHandoverDelivery(): Promise<CronJobResult> {
  const report = await runPropertyHandoverDeliveryQueue(getAdminFirestore());
  return {
    summary: `handover files: queued ${report.queued}, completed ${report.completed}, copied ${report.copied}, `
      + `failed files ${report.failedFiles}, failed handovers ${report.failedHandovers}, deferred ${report.deferred}`,
    metrics: { ...report },
  };
}
