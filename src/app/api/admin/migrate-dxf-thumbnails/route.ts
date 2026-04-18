/**
 * =============================================================================
 * POST /api/admin/migrate-dxf-thumbnails (ADR-312 Phase 3)
 * =============================================================================
 *
 * Super-admin endpoint that back-fills `thumbnailUrl` + `thumbnailStoragePath`
 * on legacy DXF `files` records — the ones uploaded before the
 * `onDxfProcessedFinalize` Cloud Function existed. The runtime behaviour is
 * identical to the trigger so the first natural DXF upload after deploy and
 * this migration converge on the same SSoT output.
 *
 * Body: `{ companyId, limit?: number = 50, dryRun?: boolean = false }`
 * Returns: `MigrationReport` (processed / rasterized / skipped / failed counts,
 * per-file items).
 *
 * @module app/api/admin/migrate-dxf-thumbnails/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { apiSuccess, ApiError, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { runDxfThumbnailMigration, type MigrationReport } from './helpers';

const logger = createModuleLogger('MigrateDxfThumbnailsRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BodySchema = z
  .object({
    companyId: z.string().min(1),
    limit: z.number().int().min(1).max(200).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

async function handle(
  req: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<MigrationReport>>> {
  if (ctx.globalRole !== 'super_admin') {
    throw new ApiError(403, 'Only super_admin can run this migration');
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.text();
    body = BodySchema.parse(JSON.parse(raw));
  } catch {
    throw new ApiError(400, 'Invalid request body');
  }

  const limit = body.limit ?? 50;
  const dryRun = body.dryRun ?? false;

  logger.info('DXF thumbnail migration started', {
    companyId: body.companyId, uid: ctx.uid, limit, dryRun,
  });

  const report = await runDxfThumbnailMigration({
    companyId: body.companyId,
    limit,
    dryRun,
  });

  logger.info('DXF thumbnail migration completed', {
    companyId: body.companyId,
    processed: report.processed,
    rasterized: report.rasterized,
    failed: report.failed,
    dryRun,
  });

  return apiSuccess<MigrationReport>(report, 'DXF thumbnail migration report');
}

export async function POST(request: NextRequest) {
  const handler = withSensitiveRateLimit(
    withAuth<ApiSuccessResponse<MigrationReport>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handle(req, ctx)
    )
  );
  return handler(request);
}
