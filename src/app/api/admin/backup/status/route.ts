/**
 * =============================================================================
 * ENTERPRISE BACKUP API — STATUS ENDPOINT (ADR-313)
 * =============================================================================
 *
 * GET /api/admin/backup/status
 *
 * Returns the current backup status from Firestore (system/backup_status).
 * Used for polling progress during a running backup.
 *
 * @module api/admin/backup/status
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('BackupStatusRoute');

const BACKUP_STATUS_PATH = 'system/backup_status';

/**
 * GET /api/admin/backup/status
 *
 * Returns current backup status.
 */
export async function GET(request: NextRequest) {
  const handler = withStandardRateLimit(withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handleGetStatus();
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handleGetStatus(): Promise<NextResponse> {
  try {
    const db = getAdminFirestore();
    const statusDoc = await db.doc(BACKUP_STATUS_PATH).get();

    if (!statusDoc.exists) {
      return NextResponse.json({
        success: true,
        status: null,
        message: 'No backup has been run yet',
      });
    }

    return NextResponse.json({
      success: true,
      status: statusDoc.data(),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to read backup status: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
