/**
 * DELETE /api/contacts/[contactId]/permanent-delete
 *
 * Permanently deletes a contact that is already in trash (status='deleted').
 * Delegates to centralized soft-delete engine (ADR-281).
 *
 * @module api/contacts/[contactId]/permanent-delete
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { permanentDelete } from '@/lib/firestore/soft-delete-engine';

interface PermanentDeleteResponse {
  contactId: string;
  deleted: boolean;
}

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<PermanentDeleteResponse>>(
    async (
      _request: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
      segmentData?: { params: Promise<{ contactId: string }> }
    ) => {
      const { contactId } = await segmentData!.params;

      if (!contactId) {
        throw new ApiError(400, 'Contact ID is required');
      }

      const adminDb = getAdminFirestore();

      // 🛡️ ADR-281: Centralized permanent-delete (tenant + trash guard + ADR-226 cascade)
      await permanentDelete(adminDb, 'contact', contactId, ctx.uid, ctx.companyId);

      await logAuditEvent(ctx, 'data_deleted', 'contact', 'api', {
        newValue: { type: 'status', value: { contactId, deleted: true } },
        metadata: { reason: 'Contact permanently deleted from trash' },
      });

      return apiSuccess<PermanentDeleteResponse>(
        { contactId, deleted: true },
        'Contact permanently deleted'
      );
    },
    { permissions: 'crm:contacts:delete' }
  )
);
