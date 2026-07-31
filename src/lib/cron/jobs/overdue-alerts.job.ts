/**
 * JOB: overdue-alerts — σάρωση ληξιπρόθεσμων δόσεων και δημιουργία ειδοποιήσεων.
 *
 * @module lib/cron/jobs/overdue-alerts
 * @enterprise ADR-234 Phase 5
 */

import 'server-only';

import { OverdueAlertService } from '@/services/overdue-alert.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runOverdueAlerts(): Promise<CronJobResult> {
  const result = await OverdueAlertService.scanAndNotify();

  // Ο τύπος επιστροφής της υπηρεσίας είναι δικό της συμβόλαιο· κρατάμε μόνο
  // αριθμητικά πεδία ως metrics ώστε το job να μη σπάει αν εκείνη προσθέσει πεδία.
  const metrics: Record<string, number> = {};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number') metrics[key] = value;
  }

  return { summary: JSON.stringify(result), metrics };
}
