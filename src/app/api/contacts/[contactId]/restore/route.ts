/**
 * POST /api/contacts/[contactId]/restore
 *
 * Restores a soft-deleted contact from trash to its previous status.
 * Only works on contacts with status='deleted'.
 *
 * @module api/contacts/[contactId]/restore
 * @enterprise ADR-191 pattern — Soft-delete lifecycle (deleted → restored)
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactRestore');

interface RestoreResponse {
  contactId: string;
  restoredStatus: string;
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<RestoreResponse>>(
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

      // Guard: only soft-deleted contacts can be restored
      if (contactData?.status !== 'deleted') {
        throw new ApiError(409, 'Contact is not in trash');
      }

      const restoredStatus = contactData.previousStatus || 'active';

      logger.info('Restoring contact from trash', { contactId, restoredStatus });

      // 🔄 Restore: clear delete fields, set previous status
      await contactRef.update({
        status: restoredStatus,
        previousStatus: FieldValue.delete(),
        deletedAt: FieldValue.delete(),
        deletedBy: FieldValue.delete(),
        restoredAt: FieldValue.serverTimestamp(),
        restoredBy: ctx.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 📊 Audit trail
      await logAuditEvent(ctx, 'data_updated', 'contact', 'api', {
        newValue: {
          type: 'status',
          value: { contactId, restoredStatus },
        },
        metadata: { reason: 'Contact restored from trash' },
      });

      return apiSuccess<RestoreResponse>(
        { contactId, restoredStatus },
        'Contact restored from trash'
      );
    },
    { permissions: 'crm:contacts:delete' }
  )
);
