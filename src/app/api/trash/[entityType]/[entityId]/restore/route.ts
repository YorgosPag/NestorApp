/**
 * POST /api/trash/{entityType}/{entityId}/restore
 *
 * Centralized restore endpoint for ALL soft-deletable entities.
 *
 * @module api/trash/[entityType]/[entityId]/restore
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';
import { isSoftDeletableEntity, SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface RestoreResponse {
  entityType: string;
  entityId: string;
  restoredStatus: string;
}

export const POST = withStandardRateLimit(
  withAuth(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
      segmentData?: { params: Promise<{ entityType: string; entityId: string }> }
    ) => {
      const { entityType, entityId } = await segmentData!.params;

      if (!isSoftDeletableEntity(entityType)) {
        throw new ApiError(400, `Invalid entity type: ${entityType}`);
      }

      const typedEntityType = entityType as SoftDeletableEntityType;
      const config = SOFT_DELETE_CONFIG[typedEntityType];
      const adminDb = getAdminFirestore();

      const result = await restoreFromTrash(
        adminDb, typedEntityType, entityId, ctx.uid, ctx.companyId, ctx.email ?? undefined
      );

      await logAuditEvent(ctx, 'restored', entityType, 'api', {
        newValue: { type: 'status', value: { entityId, restoredStatus: result.restoredStatus } },
        metadata: { reason: `${config.labelEn} restored from trash` },
      });

      return apiSuccess<RestoreResponse>(
        { entityType, entityId, restoredStatus: result.restoredStatus },
        `${config.labelEn} restored from trash`
      );
    },
    {}
  )
);
