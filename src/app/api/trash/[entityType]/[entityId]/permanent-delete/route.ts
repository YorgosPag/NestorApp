/**
 * DELETE /api/trash/{entityType}/{entityId}/permanent-delete
 *
 * Centralized permanent-delete endpoint for ALL soft-deletable entities.
 * Entity MUST be in trash (status='deleted') before permanent deletion.
 *
 * @module api/trash/[entityType]/[entityId]/permanent-delete
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { permanentDelete } from '@/lib/firestore/soft-delete-engine';
import { isSoftDeletableEntity, SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

interface PermanentDeleteResponse {
  entityType: string;
  entityId: string;
  deleted: boolean;
}

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PermanentDeleteResponse>>(
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

      await permanentDelete(
        adminDb, typedEntityType, entityId, ctx.uid, ctx.companyId
      );

      await logAuditEvent(ctx, 'data_deleted', entityType, 'api', {
        newValue: { type: 'status', value: { entityId, deleted: true } },
        metadata: { reason: `${config.labelEn} permanently deleted from trash` },
      });

      return apiSuccess<PermanentDeleteResponse>(
        { entityType, entityId, deleted: true },
        `${config.labelEn} permanently deleted`
      );
    },
    {}
  )
);
