/**
 * =============================================================================
 * File Purge API — Permanent Deletion of Expired Trash
 * =============================================================================
 *
 * POST /api/files/purge
 * Authorization: Cron secret header or super_admin
 *
 * Finds files in trash past their purgeAt date, permanently deletes them
 * from Firestore (marks as purged). Storage cleanup is separate.
 *
 * @module api/files/purge
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.2)
 * @compliance ISO 27001 §A.8.3 (Media Handling)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { HOLD_TYPES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { verifyCronAuthorization } from '@/lib/cron-auth';

const logger = createModuleLogger('FilePurgeRoute');

export const maxDuration = 60;

// ============================================================================
// TYPES
// ============================================================================

interface PurgeResult {
  success: boolean;
  purgedCount: number;
  skippedCount: number;
  errors: string[];
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<PurgeResult>> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json(
      { success: false, purgedCount: 0, skippedCount: 0, errors: ['Unauthorized'] },
      { status: 401 },
    );
  }

  try {
    const db = getAdminFirestore();
    const now = nowISO();

    // Query trashed files with expired purgeAt
    const snapshot = await db
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.IS_DELETED, '==', true)
      .where('purgeAt', '<=', now)
      .limit(100) // Process in batches of 100
      .get();

    let purgedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip files with active holds
      if (data.hold && data.hold !== HOLD_TYPES.NONE) {
        skippedCount++;
        continue;
      }

      // Skip files with active retention
      if (data.retentionUntil) {
        const retentionDate = new Date(data.retentionUntil);
        if (retentionDate > new Date()) {
          skippedCount++;
          continue;
        }
      }

      try {
        // 🏢 ENTERPRISE: Delete binary file from Firebase Storage BEFORE marking as purged
        const storagePath = data.storagePath as string | undefined;
        if (storagePath) {
          try {
            const bucket = getAdminStorage().bucket();
            await bucket.file(storagePath).delete();
            logger.info('Storage file deleted', { fileId: doc.id, storagePath });
          } catch (storageErr) {
            // File may already be deleted or path invalid — log but don't block purge
            logger.warn('Storage file deletion failed (non-blocking)', {
              fileId: doc.id,
              storagePath,
              error: getErrorMessage(storageErr),
            });
          }
        }

        // Mark as purged in Firestore
        await doc.ref.update({
          lifecycleState: 'purged',
          purgedAt: nowISO(),
          updatedAt: nowISO(),
        });

        // Audit log
        const { generateAuditId } = await import('@/services/enterprise-id.service');
        await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
          fileId: doc.id,
          action: 'delete',
          performedBy: 'system:purge',
          timestamp: nowISO(),
          metadata: {
            purgeType: 'auto',
            originalPurgeAt: data.purgeAt ?? null,
            category: data.category ?? null,
          },
        });

        purgedCount++;
      } catch (err) {
        const msg = getErrorMessage(err);
        errors.push(`${doc.id}: ${msg}`);
        logger.error('Failed to purge file', { fileId: doc.id, error: msg });
      }
    }

    logger.info('Purge cycle complete', { purgedCount, skippedCount, errors: errors.length });

    return NextResponse.json({
      success: true,
      purgedCount,
      skippedCount,
      errors,
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Purge failed');
    logger.error(`Purge error: ${message}`);
    return NextResponse.json(
      { success: false, purgedCount: 0, skippedCount: 0, errors: [message] },
      { status: 500 },
    );
  }
}
