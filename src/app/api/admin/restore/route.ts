/**
 * =============================================================================
 * ENTERPRISE RESTORE API — RESTORE ENDPOINT (ADR-313 Phase 4)
 * =============================================================================
 *
 * POST /api/admin/restore
 *
 * Triggers a restore from a backup. Reads backup data from GCS,
 * runs schema reconciliation, creates pre-restore snapshot, then
 * writes documents to Firestore in tier order.
 *
 * Body: { backupId: string, options?: RestoreOptions }
 *
 * Security:
 * - withAuth: admin:backup:execute permission (super_admin only)
 * - withSensitiveRateLimit: 20 req/min
 *
 * @module api/admin/restore
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RestoreService } from '@/services/backup/restore.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { RestoreOptions, RestoreStatus } from '@/services/backup/backup-manifest.types';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('RestoreRoute');

const RESTORE_STATUS_PATH = 'system/restore_status';

export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleRestore(req, ctx);
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handleRestore(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  let body: { backupId?: string; options?: RestoreOptions };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { backupId, options } = body;

  if (!backupId || typeof backupId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'backupId is required' },
      { status: 400 },
    );
  }

  logger.info(`Restore triggered by user ${ctx.userId} from backup ${backupId}`);

  try {
    const db = getAdminFirestore();
    const restoreService = new RestoreService();

    const updateStatus = async (status: Partial<RestoreStatus>): Promise<void> => {
      try {
        await db.doc(RESTORE_STATUS_PATH).set(
          { ...status, updatedAt: nowISO() },
          { merge: true },
        );
      } catch (error) {
        logger.warn(`Failed to update restore status: ${getErrorMessage(error)}`);
      }
    };

    const result = await restoreService.executeRestore(
      backupId,
      ctx.userId,
      options,
      updateStatus,
    );

    await updateStatus({
      restoreId: result.restoreId,
      phase: 'completed',
      documentsRestored: result.documentsRestored,
      documentsSkipped: result.documentsSkipped,
      completedAt: nowISO(),
    });

    logger.info(`Restore completed: ${result.restoreId} — ${result.documentsRestored} docs in ${result.durationMs}ms`);

    return NextResponse.json({
      success: true,
      restoreId: result.restoreId,
      backupId,
      documentsRestored: result.documentsRestored,
      documentsSkipped: result.documentsSkipped,
      storageRestored: result.storageRestored,
      storageSkipped: result.storageSkipped,
      snapshotId: result.snapshotId,
      durationMs: result.durationMs,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Restore failed: ${errorMessage}`);

    try {
      const db = getAdminFirestore();
      await db.doc(RESTORE_STATUS_PATH).set(
        {
          phase: 'failed',
          error: errorMessage,
          completedAt: nowISO(),
        },
        { merge: true },
      );
    } catch {
      // Best-effort status update
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
