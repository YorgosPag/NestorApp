import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import type { Contact } from '@/types/contacts';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  FILE_LIFECYCLE_STATES,
  HOLD_TYPES,
  RETENTION_BY_CATEGORY,
  DEFAULT_RETENTION_POLICIES,
  type FileCategory,
} from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { mapFirestoreContactToResponse } from './contact-data-mapper';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('ContactRoute');

type FirestoreContactData = Contact & Record<string, unknown> & {
  id: string;
  companyId?: string;
};

export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/contacts/[contactId]
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<unknown>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        logger.info('Loading contact', { contactId });

    if (!contactId) {
      return NextResponse.json({ success: false, error: 'Contact ID is required' }, { status: 400 });
    }

    if (typeof contactId !== 'string' || contactId.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid contact ID format' }, { status: 400 });
    }

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({
        success: false, error: 'Database connection not available', contactId
      }, { status: 503 });
    }

    const contactDoc = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .doc(contactId)
      .get();

    if (!contactDoc.exists) {
      return NextResponse.json({ success: false, error: 'Contact not found', contactId }, { status: 404 });
    }

    const contactData = { id: contactDoc.id, ...contactDoc.data() } as FirestoreContactData;

    // TENANT ISOLATION
    if (contactData.companyId !== ctx.companyId) {
      logger.warn('TENANT ISOLATION VIOLATION', { uid: ctx.uid, contactId });
      return NextResponse.json({ success: false, error: 'Access denied - Contact not found', contactId }, { status: 403 });
    }

    const contact = mapFirestoreContactToResponse(contactData);

    logger.info('Contact loaded successfully', { displayName: contact.displayName, contactId });

    return NextResponse.json({
      success: true,
      contact,
      contactId,
      timestamp: nowISO()
    });

      } catch (error) {
        logger.error('Error loading contact', { error });

        const isFirebaseError = error instanceof Error && error.message.includes('Firebase');
        const isNetworkError = error instanceof Error && error.message.includes('network');

        let statusCode = 500;
        if (isFirebaseError) statusCode = 503;
        else if (isNetworkError) statusCode = 502;

        return NextResponse.json(
          {
            success: false,
            error: getErrorMessage(error, 'Άγνωστο σφάλμα φόρτωσης επαφής'),
            contactId: contactId || null,
            timestamp: nowISO()
          },
          { status: statusCode }
        );
      }
    },
    { permissions: 'crm:contacts:view' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE /api/contacts/[contactId]
// =============================================================================

const FIRESTORE_BATCH_SIZE = 500;

async function cascadeContactFilesToTrash(
  db: FirebaseFirestore.Firestore,
  contactId: string,
  companyId: string,
  trashedBy: string,
): Promise<{ trashed: number; skipped: number }> {
  const filesSnap = await db
    .collection(COLLECTIONS.FILES)
    .where('companyId', '==', companyId)
    .where('entityType', '==', 'contact')
    .where('entityId', '==', contactId)
    .where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE)
    .get();

  if (filesSnap.empty) return { trashed: 0, skipped: 0 };

  let trashed = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const fileDoc of filesSnap.docs) {
    const data = fileDoc.data();

    if (data.hold && data.hold !== HOLD_TYPES.NONE) {
      logger.warn('Cascade trash: skipping file on hold', { fileId: fileDoc.id, hold: data.hold });
      skipped++;
      continue;
    }

    const retentionDays =
      RETENTION_BY_CATEGORY[data.category as FileCategory] ??
      DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS;
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + retentionDays);

    batch.update(fileDoc.ref, {
      lifecycleState: FILE_LIFECYCLE_STATES.TRASHED,
      isDeleted: true,
      trashedAt: FieldValue.serverTimestamp(),
      trashedBy,
      purgeAt: purgeDate.toISOString(),
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: trashedBy,
      updatedAt: FieldValue.serverTimestamp(),
    });

    trashed++;
    batchCount++;

    if (batchCount === FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  logger.info('Cascade trash complete', { contactId, trashed, skipped });
  return { trashed, skipped };
}

interface ContactDeleteResponse {
  contactId: string;
  deleted: boolean;
  filesCascaded: number;
  filesSkipped: number;
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<ApiSuccessResponse<ContactDeleteResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!contactId) {
        throw new ApiError(400, 'Contact ID is required');
      }

      const adminDb = getAdminFirestore();

      const contactSnap = await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      const contactData = contactSnap.data();
      const contactName: string = contactData?.['companyName'] ?? contactData?.['firstName']
        ? `${contactData?.['firstName'] ?? ''} ${contactData?.['lastName'] ?? ''}`.trim()
        : contactId;

      // 🗑️ ADR-281: Centralized soft-delete engine (tenant check + audit built-in)
      await softDelete(adminDb, 'contact', contactId, ctx.uid, ctx.companyId, ctx.email ?? undefined);

      // Cascade: move all active contact files to trash
      const { trashed: filesCascaded, skipped: filesSkipped } =
        await cascadeContactFilesToTrash(adminDb, contactId, ctx.companyId, ctx.uid);

      logger.info('Contact moved to trash', { contactId, email: ctx.email, filesCascaded, filesSkipped });

      await logAuditEvent(ctx, 'soft_deleted', 'contact', 'api', {
        newValue: { type: 'status', value: { contactId } },
        metadata: { reason: 'Contact moved to trash via API', filesCascaded, filesSkipped },
      });

      return apiSuccess<ContactDeleteResponse>(
        { contactId, deleted: true, filesCascaded, filesSkipped },
        'Contact moved to trash'
      );
    },
    { permissions: 'crm:contacts:delete' }
  ));

  return handler(request);
}
