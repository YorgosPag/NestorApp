/**
 * =============================================================================
 * Cron: Purge Deleted Contacts — Daily cleanup of expired trashed contacts
 * =============================================================================
 *
 * GET /api/cron/purge-deleted-contacts
 *
 * ⚠️ **SUPERSEDED από το `/api/cron/purge-deleted-entities`** — αυτό σαρώνει *όλους* τους
 * soft-deletable τύπους, και το `SOFT_DELETE_CONFIG.contact` δείχνει ήδη στην ίδια
 * `COLLECTIONS.CONTACTS`. Καταχωρημένο στο `src/config/cron-schedule.ts` ως `enabled: false`
 * με `supersededBy`. **Δεν διαγράφηκε** επειδή ο αντικαταστάτης δεν έχει τρέξει ποτέ σε
 * παραγωγή (κανένα cron δεν έτρεξε 2026-05-09 → 2026-07-31). Αφαίρεση μόνο αφού το
 * `purge-deleted-entities` δείξει επιτυχημένα check-ins στο Sentry — βλ. ADR-739.
 *
 * Permanently deletes contacts that have been in trash for >30 days.
 * Uses ADR-226 executeDeletion() for full dependency check + cascade.
 * Contacts with blocking dependencies are skipped (logged as warning).
 *
 * ⚠️ Το `verifyCronAuthorization` προστέθηκε 2026-07-31 — το route έκανε **οριστική**
 * διαγραφή χωρίς καμία ταυτοποίηση. Μην το αφαιρέσεις· επιβάλλεται από test.
 *
 * @module api/cron/purge-deleted-contacts
 * @enterprise ADR-191 pattern — Soft-delete lifecycle auto-purge
 * @see ADR-739 — χρονοπρογραμματισμός
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { TRASH_RETENTION_MS, rejectUnauthorizedCron } from '@/lib/cron-auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CronPurgeDeletedContacts');

export const maxDuration = 60;

/** Maximum contacts to purge per cron run (avoid timeout) */
const BATCH_LIMIT = 50;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startTime = Date.now();

  try {
    const db = getAdminFirestore();
    const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

    // Query contacts with status='deleted' and deletedAt older than 30 days
    const snapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where('status', '==', 'deleted')
      .where('deletedAt', '<=', cutoffDate)
      .limit(BATCH_LIMIT)
      .get();

    if (snapshot.empty) {
      logger.info('No expired trashed contacts to purge');
      return NextResponse.json({
        success: true,
        purged: 0,
        skipped: 0,
        checked: 0,
        durationMs: Date.now() - startTime,
      });
    }

    let purged = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      try {
        const contactData = doc.data();
        const contactCompanyId = (contactData.companyId as string) ?? '';
        // executeDeletion runs dependency check + cascade + hard delete
        await executeDeletion(db, 'contact', doc.id, 'system:cron-purge', contactCompanyId);
        purged++;
        logger.info('Purged expired trashed contact', { contactId: doc.id });
      } catch (error) {
        // Dependency blocking or other error — skip, don't fail entire batch
        skipped++;
        logger.warn('Skipped purge — contact has dependencies', {
          contactId: doc.id,
          error: getErrorMessage(error),
        });
      }
    }

    const result = {
      success: true,
      purged,
      skipped,
      checked: snapshot.size,
      durationMs: Date.now() - startTime,
    };

    logger.info('Contact purge complete', result);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Contact purge cron failed', { error: getErrorMessage(error) });
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
