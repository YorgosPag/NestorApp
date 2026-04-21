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
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { restoreFromTrash } from '@/lib/firestore/soft-delete-engine';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_LIFECYCLE_STATES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactRestoreRoute');

const FIRESTORE_BATCH_SIZE = 500;

async function cascadeRestoreContactFiles(
  db: FirebaseFirestore.Firestore,
  contactId: string,
  companyId: string,
  restoredBy: string,
): Promise<{ restored: number }> {
  const filesSnap = await db
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', companyId)
    .where('entityType', '==', 'contact')
    .where('entityId', '==', contactId)
    .where('lifecycleState', '==', FILE_LIFECYCLE_STATES.TRASHED)
    .get();

  if (filesSnap.empty) return { restored: 0 };

  let restored = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const fileDoc of filesSnap.docs) {
    batch.update(fileDoc.ref, {
      lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
      isDeleted: false,
      trashedAt: FieldValue.delete(),
      trashedBy: FieldValue.delete(),
      purgeAt: FieldValue.delete(),
      deletedAt: FieldValue.delete(),
      deletedBy: FieldValue.delete(),
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy,
      updatedAt: FieldValue.serverTimestamp(),
    });

    restored++;
    batchCount++;

    if (batchCount === FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  logger.info('Cascade restore complete', { contactId, restored });
  return { restored };
}

interface RestoreResponse {
  contactId: string;
  restoredStatus: string;
  filesRestored: number;
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

      // Cascade: restore all trashed contact files
      const { restored: filesRestored } =
        await cascadeRestoreContactFiles(adminDb, contactId, ctx.companyId, ctx.uid);

      await logAuditEvent(ctx, 'restored', 'contact', 'api', {
        newValue: { type: 'status', value: { contactId, restoredStatus: result.restoredStatus } },
        metadata: { reason: 'Contact restored from trash', filesRestored },
      });

      return apiSuccess<RestoreResponse>(
        { contactId, restoredStatus: result.restoredStatus, filesRestored },
        'Contact restored from trash'
      );
    },
    { permissions: 'crm:contacts:delete' }
  )
);
