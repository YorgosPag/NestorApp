/**
 * DELETE /api/contacts/[contactId]/permanent-delete
 *
 * Permanently deletes a contact that is already in trash (status='deleted').
 * Runs full ADR-226 dependency check before removal.
 *
 * @module api/contacts/[contactId]/permanent-delete
 * @enterprise ADR-226 — Deletion Guard + ADR-191 lifecycle terminal state
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactPermanentDelete');

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
      const contactRef = adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId);
      const contactDoc = await contactRef.get();

      if (!contactDoc.exists) {
        throw new ApiError(404, 'Contact not found');
      }

      const contactData = contactDoc.data();

      // 🔒 TENANT ISOLATION
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && contactData?.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Unauthorized: Contact belongs to different company');
      }

      // Guard: only trashed contacts can be permanently deleted
      if (contactData?.status !== 'deleted') {
        throw new ApiError(409, 'Contact must be in trash before permanent deletion');
      }

      logger.info('Permanently deleting contact', { contactId });

      // 🛡️ ADR-226: Full dependency check + cascade + hard delete
      await executeDeletion(adminDb, 'contact', contactId, ctx.uid, ctx.companyId);

      logger.info('Contact permanently deleted', { contactId, email: ctx.email });

      // 📊 Auth audit
      await logAuditEvent(ctx, 'data_deleted', 'contact', 'api', {
        newValue: {
          type: 'status',
          value: {
            contactId,
            displayName: contactData?.firstName
              ? `${contactData.firstName} ${contactData.lastName ?? ''}`.trim()
              : contactData?.companyName ?? '',
          },
        },
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
