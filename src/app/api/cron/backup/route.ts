/**
 * =============================================================================
 * CRON: SCHEDULED BACKUP — ADR-313 Phase 2
 * =============================================================================
 *
 * **Πυροκροτητής, όχι λογική** — η πολιτική (αν είναι ενεργό το πρόγραμμα, πόσος
 * χρόνος πρέπει να έχει περάσει, retention) ζει στο `BackupSchedulerService`, και ο
 * προσαρμογέας στο `lib/cron/jobs/backup.job.ts`.
 *
 * ⚠️ Αυτό είναι το job του οποίου η τρίμηνη σιωπή είναι το σοβαρότερο εύρημα του
 * ADR-740: από 2026-05-09 έως 2026-07-31 **δεν λήφθηκε κανένα αντίγραφο ασφαλείας**,
 * επειδή το πρόγραμμα ζούσε μόνο στο νεκρό `vercel.json`.
 *
 * @module api/cron/backup
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 2
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (04:00 Europe/Athens)
 */

import { NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { runBackup } from '@/lib/cron/jobs/backup.job';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CronBackup');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await runBackup();

    logger.info('Scheduled backup cron result', { summary: result.summary });

    return NextResponse.json({ success: true, summary: result.summary, ...result.metrics });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Scheduled backup cron failed: ${errorMessage}`);

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
