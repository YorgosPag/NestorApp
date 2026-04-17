/**
 * =============================================================================
 * ENTERPRISE BACKUP API — LIST BACKUPS ENDPOINT (ADR-313)
 * =============================================================================
 *
 * GET /api/admin/backup/list
 *
 * Returns a list of all backup manifests from GCS, sorted newest-first.
 * Uses Promise.allSettled to handle missing/corrupt manifests gracefully.
 *
 * @module api/admin/backup/list
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { BackupGcsService } from '@/services/backup/backup-gcs.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BackupListRoute');

/**
 * GET /api/admin/backup/list
 *
 * Returns all backup manifests sorted by creation date (newest first).
 */
export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleListBackups();
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handleListBackups(): Promise<NextResponse> {
  try {
    const gcsService = new BackupGcsService();
    const backupIds = await gcsService.listBackups();

    if (backupIds.length === 0) {
      return NextResponse.json({ success: true, backups: [] });
    }

    // Read manifests in parallel — allSettled handles missing/corrupt
    const results = await Promise.allSettled(
      backupIds.map(id => gcsService.readManifest(id))
    );

    const backups = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof gcsService.readManifest>>> =>
        r.status === 'fulfilled'
      )
      .map(r => r.value);

    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
      logger.warn(`${failedCount} backup manifest(s) could not be read`);
    }

    return NextResponse.json({
      success: true,
      backups,
      total: backups.length,
      skipped: failedCount,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to list backups: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
