/**
 * =============================================================================
 * CRON: SCHEDULED BACKUP — ADR-313 Phase 2
 * =============================================================================
 *
 * GET /api/cron/backup
 * Triggered daily at 01:00 UTC by Vercel Cron.
 *
 * Reads BackupConfig from Firestore system/backup_config.
 * If scheduleEnabled=true and enough time since last backup:
 *   → full backup (Firestore + Storage) → GCS → retention cleanup
 *
 * Security:
 * - verifyCronAuthorization() — SSoT from lib/cron-auth
 * - Vercel Cron sends CRON_SECRET as Bearer token
 *
 * Configuration in vercel.json:
 * ```json
 * { "path": "/api/cron/backup", "schedule": "0 1 * * *" }
 * ```
 *
 * @module api/cron/backup
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { BackupSchedulerService } from '@/services/backup/backup-scheduler.service';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CronBackup');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scheduler = new BackupSchedulerService();
    const result = await scheduler.executeScheduledBackup();

    logger.info('Scheduled backup cron result', {
      executed: result.executed,
      reason: result.reason,
      backupId: result.backupId ?? null,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Scheduled backup cron failed: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
