/**
 * =============================================================================
 * ENTERPRISE RESTORE API — PREVIEW ENDPOINT (ADR-313 Phase 4)
 * =============================================================================
 *
 * POST /api/admin/restore/preview
 *
 * Dry-run preview of a restore operation. Returns what would change
 * without writing anything to Firestore.
 *
 * Body: { backupId: string, options?: RestoreOptions }
 *
 * Security:
 * - withAuth: admin:backup:execute permission (super_admin only)
 * - withSensitiveRateLimit: 20 req/min
 *
 * @module api/admin/restore/preview
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { RestoreService } from '@/services/backup/restore.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { RestoreOptions } from '@/services/backup/backup-manifest.types';

const logger = createModuleLogger('RestorePreviewRoute');

export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      return handlePreview(req, ctx);
    },
    { permissions: 'admin:backup:execute' }
  ));

  return handler(request);
}

async function handlePreview(
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

  logger.info(`Restore preview requested by ${ctx.userId} for backup ${backupId}`);

  try {
    const restoreService = new RestoreService();
    const preview = await restoreService.previewRestore(backupId, options);

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Restore preview failed: ${errorMessage}`);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
