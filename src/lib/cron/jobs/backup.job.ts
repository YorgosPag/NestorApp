/**
 * JOB: backup — καθημερινό πλήρες αντίγραφο ασφαλείας (Firestore + Storage → GCS).
 *
 * Η πολιτική (αν είναι ενεργό, πόσος χρόνος πρέπει να έχει περάσει, retention) ζει
 * ολόκληρη στο `BackupSchedulerService`. Εδώ μένει ο προσαρμογέας.
 *
 * ⚠️ Αυτό είναι το job του οποίου η τρίμηνη σιωπή είναι το σοβαρότερο εύρημα του
 * ADR-739: από 2026-05-09 δεν λήφθηκε **κανένα** αντίγραφο ασφαλείας.
 *
 * @module lib/cron/jobs/backup
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 2
 */

import { BackupSchedulerService } from '@/services/backup/backup-scheduler.service';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runBackup(): Promise<CronJobResult> {
  const scheduler = new BackupSchedulerService();
  const result = await scheduler.executeScheduledBackup();

  // `executed: false` είναι θεμιτό (π.χ. `scheduleEnabled` κλειστό, ή έγινε ήδη
  // πρόσφατα): ο ίδιος ο scheduler είναι ο κριτής. Το καταγράφουμε ως επιτυχές
  // check-in — το job **έτρεξε** και αποφάσισε· δεν απέτυχε.
  return {
    summary: result.executed
      ? `backup ${result.backupId ?? 'ok'}`
      : `skipped: ${result.reason}`,
    metrics: { executed: result.executed ? 1 : 0 },
  };
}
