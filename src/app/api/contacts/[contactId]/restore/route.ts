/**
 * POST /api/contacts/[contactId]/restore
 *
 * Restores a soft-deleted contact from trash to its previous status.
 * Delegates to centralized soft-delete engine (ADR-281).
 *
 * @module api/contacts/[contactId]/restore
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';

interface RestoreResponse {
  contactId: string;
  restoredStatus: string;
}

export const POST = withStandardRateLimit(
  withAuth(
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

      // 🔄 ADR-281: Centralized restore engine (tenant check + audit built-in)
      const result = await restoreFromTrash(adminDb, 'contact', contactId, ctx.uid, ctx.companyId, ctx.email ?? undefined);

      await logAuditEvent(ctx, 'restored', 'contact', 'api', {
        newValue: { type: 'status', value: { contactId, restoredStatus: result.restoredStatus } },
        metadata: { reason: 'Contact restored from trash' },
      });

      return apiSuccess<RestoreResponse>(
        { contactId, restoredStatus: result.restoredStatus },
        'Contact restored from trash'
      );
    },
    { permissions: 'crm:contacts:delete' }
  )
);
