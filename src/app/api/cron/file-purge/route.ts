/**
 * =============================================================================
 * Cron: File Purge — Daily cleanup of expired trash + orphan PENDING files
 * =============================================================================
 *
 * GET /api/cron/file-purge
 * Triggered daily at 02:00 UTC by Vercel Cron
 *
 * Phase A: Permanently purge expired trashed files (isDeleted + purgeAt <= now)
 * Phase B: Clean up orphan PENDING/FAILED files older than TTL (default 48h)
 *
 * @module api/cron/file-purge
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { FILE_STATUS } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import {
  purgeFileRecord,
  isFileHeld,
  PENDING_FILE_TTL_MS,
} from '@/services/file-record/file-purge-helpers';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('CronFilePurge');

export const maxDuration = 60;

/** Phase A: Purge trashed files past their purge date */
async function purgeExpiredTrash(
  db: FirebaseFirestore.Firestore,
  now: string
): Promise<{ purged: number; skipped: number; checked: number }> {
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.IS_DELETED, '==', true)
    .where('purgeAt', '<=', now)
    .limit(100)
    .get();

  let purged = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (isFileHeld(data)) {
      skipped++;
      continue;
    }

    const result = await purgeFileRecord({
      fileId: doc.id,
      storagePath: data.storagePath as string | undefined,
      performedBy: 'system:cron-purge',
      purgeReason: 'cron_trash',
      metadata: {
        originalPurgeAt: data.purgeAt ?? null,
        category: data.category ?? null,
      },
    });

    if (result.success) purged++;
    else skipped++;
  }

  return { purged, skipped, checked: snapshot.size };
}

/** Phase B: Clean up orphan PENDING/FAILED files older than TTL */
async function purgeOrphanPendingFiles(
  db: FirebaseFirestore.Firestore
): Promise<{ purged: number; skipped: number; checked: number }> {
  const cutoff = new Date(Date.now() - PENDING_FILE_TTL_MS).toISOString();

  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where('status', 'in', [FILE_STATUS.PENDING, FILE_STATUS.FAILED])
    .where('createdAt', '<', cutoff)
    .limit(50)
    .get();

  let purged = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (isFileHeld(data)) {
      skipped++;
      continue;
    }

    const result = await purgeFileRecord({
      fileId: doc.id,
      storagePath: data.storagePath as string | undefined,
      performedBy: 'system:cron-orphan-cleanup',
      purgeReason: 'ttl_expired',
      metadata: {
        originalStatus: data.status ?? null,
        domain: data.domain ?? null,
        ageHours: Math.round((Date.now() - new Date(data.createdAt).getTime()) / 3_600_000),
      },
    });

    if (result.success) purged++;
    else skipped++;
  }

  return { purged, skipped, checked: snapshot.size };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const now = nowISO();

    const [trash, orphans] = await Promise.all([
      purgeExpiredTrash(db, now),
      purgeOrphanPendingFiles(db),
    ]);

    logger.info('Daily file purge complete', {
      trashPurged: trash.purged,
      trashSkipped: trash.skipped,
      orphansPurged: orphans.purged,
      orphansSkipped: orphans.skipped,
    });

    return NextResponse.json({
      success: true,
      trash: { purged: trash.purged, skipped: trash.skipped, checked: trash.checked },
      orphans: { purged: orphans.purged, skipped: orphans.skipped, checked: orphans.checked },
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Purge cron failed');
    logger.error(`Cron purge error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
