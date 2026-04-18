/**
 * =============================================================================
 * ENTERPRISE BACKUP API — FULL BACKUP ENDPOINT (ADR-313)
 * =============================================================================
 *
 * POST /api/admin/backup/full
 *
 * Triggers a full backup of all Firestore collections and subcollections.
 * Backup data is written to GCS bucket as GZIP-compressed NDJSON files
 * with a manifest JSON for schema reconciliation on restore.
 *
 * Security:
 * - withAuth: admin:backup:execute permission (super_admin only)
 * - withSensitiveRateLimit: 20 req/min
 * - All operations logged via module logger
 *
 * @module api/admin/backup/full
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { BackupService } from '@/services/backup/backup.service';
import { BackupGcsService } from '@/services/backup/backup-gcs.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { BackupStatus } from '@/services/backup/backup-manifest.types';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('BackupFullRoute');

/** Firestore path for backup status tracking */
const BACKUP_STATUS_PATH = 'system/backup_status';

/**
 * POST /api/admin/backup/full
 *
 * Triggers a full enterprise backup.
 *
 * Response: { backupId, status, totalDocuments, durationMs }
 */
export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleFullBackup(ctx);
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handleFullBackup(ctx: AuthContext): Promise<NextResponse> {
  const startTime = Date.now();

  logger.info(`Full backup triggered by user: ${ctx.uid}`);

  try {
    const db = getAdminFirestore();
    const backupService = new BackupService();
    const gcsService = new BackupGcsService();

    // Ensure GCS bucket exists before writing
    await gcsService.ensureBucketExists();

    // Progress callback — writes to Firestore for status endpoint polling
    const updateStatus = async (status: Partial<BackupStatus>): Promise<void> => {
      try {
        await db.doc(BACKUP_STATUS_PATH).set(
          {
            ...status,
            updatedAt: nowISO(),
          },
          { merge: true },
        );
      } catch (error) {
        logger.warn(`Failed to update backup status: ${getErrorMessage(error)}`);
      }
    };

    // Execute full backup (gcsService passed for Storage export — Phase 3)
    const { manifest, files } = await backupService.executeFullBackup(
      ctx.uid,
      updateStatus,
      gcsService,
    );

    // Write to GCS
    const finalManifest = await gcsService.writeFullBackup(manifest, files);

    // Final status update
    await updateStatus({
      backupId: finalManifest.id,
      phase: 'completed',
      processedCollections: Object.keys(COLLECTIONS).length,
      totalCollections: Object.keys(COLLECTIONS).length,
      documentsExported: finalManifest.totalDocuments,
      completedAt: nowISO(),
    });

    logger.info(`Full backup completed: ${finalManifest.id} — ${finalManifest.totalDocuments} docs in ${finalManifest.durationMs}ms`);

    return NextResponse.json({
      success: true,
      backupId: finalManifest.id,
      totalDocuments: finalManifest.totalDocuments,
      totalCollections: finalManifest.collections.length,
      totalSubcollections: finalManifest.subcollections.length,
      totalStorageFiles: finalManifest.totalStorageFiles,
      totalStorageBytes: finalManifest.totalStorageBytes,
      durationMs: Date.now() - startTime,
      bucket: gcsService.getBucketName(),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Full backup failed: ${errorMessage}`);

    // Update status to failed
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
