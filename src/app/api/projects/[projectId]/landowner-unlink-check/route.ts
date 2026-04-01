/**
 * 🛡️ Landowner Unlink Check API
 *
 * GET /api/projects/{projectId}/landowner-unlink-check?contactId={contactId}
 *
 * Pre-check endpoint: returns dependency info before removing a landowner
 * from a project's landowners[] array. Used by the frontend to show
 * confirm / warning / blocked dialogs.
 *
 * Permission: projects:projects:update (landowner management = project editing)
 *
 * @module api/projects/[projectId]/landowner-unlink-check
 * @enterprise ADR-244 — Landowner Safety Guard
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { checkLandownerUnlink, type LandownerUnlinkResult } from '@/lib/firestore/landowner-unlink-guard';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('LandownerUnlinkCheckRoute');

// ============================================================================
// GET — Check landowner unlink dependencies
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<LandownerUnlinkResult>>(
    async (
      request: NextRequest,
      ctx: AuthContext,
      cache: PermissionCache,
      segmentData?: { params: Promise<{ projectId: string }> }
    ) => {
      // Extract params first so project-scoped authorization uses the correct resource ID
      const { projectId } = await segmentData!.params;

      // Permission check
      if (!(await hasPermission(ctx, 'projects:projects:update', { projectId }, cache))) {
        throw new ApiError(403, 'Insufficient permissions', 'FORBIDDEN');
      }

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Firestore not available', 'DB_UNAVAILABLE');
      }

      const url = new URL(request.url);
      const contactId = url.searchParams.get('contactId');

      if (!projectId || !contactId) {
        throw new ApiError(400, 'Missing projectId or contactId', 'BAD_REQUEST');
      }

      logger.info('🛡️ Landowner unlink check', { projectId, contactId });

      const result = await checkLandownerUnlink(db, projectId, contactId, ctx.companyId);

      return apiSuccess(result);
    }
  )
);
