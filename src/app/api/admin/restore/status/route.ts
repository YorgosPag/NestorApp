/**
 * =============================================================================
 * ENTERPRISE RESTORE API — STATUS ENDPOINT (ADR-313)
 * =============================================================================
 *
 * GET /api/admin/restore/status
 *
 * Returns the current restore status from Firestore (system/restore_status).
 * Used for polling progress during a running restore operation.
 *
 * @module api/admin/restore/status
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('RestoreStatusRoute');

const RESTORE_STATUS_PATH = 'system/restore_status';

/**
 * GET /api/admin/restore/status
 *
 * Returns current restore status.
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
    const statusDoc = await db.doc(RESTORE_STATUS_PATH).get();

    if (!statusDoc.exists) {
      return NextResponse.json({
        success: true,
        status: null,
        message: 'No restore has been run yet',
      });
    }

    return NextResponse.json({
      success: true,
      status: statusDoc.data(),
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to read restore status: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
