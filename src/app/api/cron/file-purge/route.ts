/**
 * =============================================================================
 * Cron: File Purge — Daily cleanup of expired trash
 * =============================================================================
 *
 * GET /api/cron/file-purge
 * Triggered daily at 02:00 UTC by Vercel Cron
 *
 * Permanently marks expired trashed files as purged.
 *
 * @module api/cron/file-purge
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { HOLD_TYPES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CronFilePurge');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify Vercel Cron authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const now = new Date().toISOString();

    // Find trashed files past their purge date
    const snapshot = await db
      .collection(COLLECTIONS.FILES)
      .where(FIELDS.IS_DELETED, '==', true)
      .where('purgeAt', '<=', now)
      .limit(100)
      .get();

    let purgedCount = 0;
    let skippedCount = 0;

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
          } catch (storageErr) {
            // File may already be deleted or path invalid — log but don't block purge
            logger.warn('Storage file deletion failed (non-blocking)', {
              fileId: doc.id,
              storagePath,
              error: getErrorMessage(storageErr),
            });
          }
        }

        await doc.ref.update({
          lifecycleState: 'purged',
          purgedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Audit log
        const { generateAuditId } = await import('@/services/enterprise-id.service');
        await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
          fileId: doc.id,
          action: 'delete',
          performedBy: 'system:cron-purge',
          timestamp: new Date().toISOString(),
          metadata: {
            purgeType: 'cron',
            originalPurgeAt: data.purgeAt ?? null,
            category: data.category ?? null,
          },
        });

        purgedCount++;
      } catch (err) {
        logger.error('Failed to purge file', {
          fileId: doc.id,
          error: getErrorMessage(err),
        });
      }
    }

    logger.info('Daily file purge complete', { purgedCount, skippedCount, total: snapshot.size });

    return NextResponse.json({
      success: true,
      purgedCount,
      skippedCount,
      totalChecked: snapshot.size,
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Purge cron failed');
    logger.error(`Cron purge error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
