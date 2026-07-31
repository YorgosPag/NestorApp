/**
 * =============================================================================
 * JOB: purge-deleted-contacts — οριστική διαγραφή ληγμένων επαφών (SUPERSEDED)
 * =============================================================================
 *
 * ⚠️ **Αντικαταστάθηκε από το `purge-deleted-entities`**, που σαρώνει *όλους* τους
 * soft-deletable τύπους — και το `SOFT_DELETE_CONFIG.contact` δείχνει ήδη στην ίδια
 * `COLLECTIONS.CONTACTS`. Δηλωμένο στο `src/config/cron-schedule.ts` ως
 * `enabled: false` με `supersededBy: 'purge-deleted-entities'`.
 *
 * **Γιατί δεν διαγράφηκε:** ο αντικαταστάτης του **δεν έχει τρέξει ποτέ σε παραγωγή** —
 * από 2026-05-09 έως 2026-07-31 δεν έτρεξε κανένα cron. Η αφαίρεση εφεδρικού πριν
 * αποδειχθεί ο αντικαταστάτης είναι ακριβώς η έκπτωση που το ADR-739 αρνείται να κάνει.
 * Αφαίρεση **μόνο** αφού το `purge-deleted-entities` δείξει επιτυχημένα check-ins.
 *
 * @module lib/cron/jobs/purge-deleted-contacts
 * @enterprise ADR-191 pattern — Soft-delete lifecycle auto-purge
 * @see ADR-739 §Αποφάσεις
 */

import { TRASH_RETENTION_MS } from '@/lib/cron-auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('CronPurgeDeletedContacts');

/** Ανώτατο πλήθος επαφών ανά εκτέλεση — βλ. σημείωση batching στο δίδυμο job. */
const BATCH_LIMIT = 50;

export interface PurgeDeletedContactsReport {
  readonly purged: number;
  readonly skipped: number;
  readonly checked: number;
  readonly durationMs: number;
}

/** Διαγράφει οριστικά επαφές που βρίσκονται στον κάδο πάνω από `TRASH_RETENTION_MS`. */
export async function purgeDeletedContacts(): Promise<PurgeDeletedContactsReport> {
  const startTime = Date.now();
  const db = getAdminFirestore();
  const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

  const snapshot = await db
    .collection(COLLECTIONS.CONTACTS)
    .where('status', '==', 'deleted')
    .where('deletedAt', '<=', cutoffDate)
    .limit(BATCH_LIMIT)
    .get();

  if (snapshot.empty) {
    logger.info('No expired trashed contacts to purge');
    return { purged: 0, skipped: 0, checked: 0, durationMs: Date.now() - startTime };
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
      // Μπλοκαρισμένη εξάρτηση ή άλλο σφάλμα — παράλειψη, όχι πτώση της παρτίδας.
      skipped++;
      logger.warn('Skipped purge — contact has dependencies', {
        contactId: doc.id,
        error: getErrorMessage(error),
      });
    }
  }

  const report = { purged, skipped, checked: snapshot.size, durationMs: Date.now() - startTime };
  logger.info('Contact purge complete', report);
  return report;
}

/** Προσαρμογέας για τον χρονοπρογραμματιστή (σήμερα ανενεργό — βλ. κεφαλίδα). */
export async function runPurgeDeletedContacts(): Promise<CronJobResult> {
  const report = await purgeDeletedContacts();
  return {
    summary: `purged ${report.purged}, skipped ${report.skipped}`,
    metrics: { purged: report.purged, skipped: report.skipped, checked: report.checked },
  };
}
