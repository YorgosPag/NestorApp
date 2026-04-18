/**
 * =============================================================================
 * ENTERPRISE BACKUP API — INCREMENTAL BACKUP ENDPOINT (ADR-313 Phase 5)
 * =============================================================================
 *
 * POST /api/admin/backup/incremental
 *
 * Triggers an incremental backup based on a parent backup.
 * Uses entity_audit_trail CDC to detect changes since the parent backup.
 *
 * Request body:
 *   { parentBackupId: string }   — required, ID of the parent backup
 *
 * Security:
 * - withAuth: admin:backup:execute permission (super_admin only)
 * - withSensitiveRateLimit: 20 req/min
 *
 * @module api/admin/backup/incremental
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 5
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { IncrementalBackupService } from '@/services/backup/incremental-backup.service';
import { BackupGcsService } from '@/services/backup/backup-gcs.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { BackupStatus } from '@/services/backup/backup-manifest.types';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('BackupIncrementalRoute');

const BACKUP_STATUS_PATH = 'system/backup_status';

export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleIncrementalBackup(req, ctx);
    },
    { permissions: 'admin:backup:execute' },
  ));

  return handler(request);
}

async function handleIncrementalBackup(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse> {
  logger.info(`Incremental backup triggered by user: ${ctx.uid}`);

  let body: { parentBackupId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { parentBackupId } = body;

  if (!parentBackupId || typeof parentBackupId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'parentBackupId is required (string)' },
      { status: 400 },
    );
  }

  try {
    const db = getAdminFirestore();
    const gcsService = new BackupGcsService();
    const incrementalService = new IncrementalBackupService();

    const updateStatus = async (status: Partial<BackupStatus>): Promise<void> => {
      try {
        await db.doc(BACKUP_STATUS_PATH).set(
          { ...status, updatedAt: nowISO() },
          { merge: true },
        );
      } catch (error) {
        logger.warn(`Failed to update backup status: ${getErrorMessage(error)}`);
      }
    };

    // Ensure GCS bucket exists before writing
    await gcsService.ensureBucketExists();

    const { manifest, files } = await incrementalService.executeIncrementalBackup(
      parentBackupId,
      ctx.uid,
      gcsService,
      updateStatus,
    );

    // Write to GCS (reuses writeFullBackup — same file structure)
    const finalManifest = await gcsService.writeFullBackup(manifest, files);

    await updateStatus({
      backupId: finalManifest.id,
      phase: 'completed',
      processedCollections: finalManifest.collections.length,
      totalCollections: finalManifest.collections.length,
      documentsExported: finalManifest.totalDocuments,
      completedAt: nowISO(),
    });

    logger.info(
      `Incremental backup completed: ${finalManifest.id} — ` +
      `${finalManifest.totalDocuments} docs in ${finalManifest.durationMs}ms`,
    );

    return NextResponse.json({
      success: true,
      backupId: finalManifest.id,
      type: 'incremental',
      parentBackupId,
      deltaFrom: finalManifest.deltaFrom,
      totalDocuments: finalManifest.totalDocuments,
      collectionsAffected: finalManifest.collections.length,
      durationMs: finalManifest.durationMs,
      warnings: finalManifest.warnings,
      bucket: gcsService.getBucketName(),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Incremental backup failed: ${errorMessage}`);

    try {
      const db = getAdminFirestore();
      await db.doc(BACKUP_STATUS_PATH).set(
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
