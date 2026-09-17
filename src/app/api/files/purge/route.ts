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
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { isFileHeld, purgeFileRecord } from '@/services/file-record/file-purge-helpers';

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
      // Hold ή ενεργή διατήρηση ⇒ παράλειψη — ο ΕΝΑΣ κριτής (ADR-864 §19, N.0.2: ήταν αντίγραφο του `isFileHeld`).
      if (isFileHeld(data)) {
        skippedCount++;
        continue;
      }

      // ADR-864 §21 (N.0.2): ήταν αντίγραφο του `purgeFileRecord` — με «non-blocking» αποτυχία
      // των bytes, δηλαδή `purged` πάνω σε bytes που η πλατφόρμα κράτησε. Ο ΕΝΑΣ γραφέας.
      const result = await purgeFileRecord({
        fileId: doc.id,
        storagePath: data.storagePath as string | undefined,
        performedBy: 'system:purge',
        purgeReason: 'cron_trash',
        metadata: {
          purgeType: 'auto',
          originalPurgeAt: (data.purgeAt as string | undefined) ?? null,
          category: (data.category as string | undefined) ?? null,
        },
      });

      if (result.success) {
        purgedCount++;
      } else {
        errors.push(`${doc.id}: ${result.error ?? 'unknown'}`);
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
