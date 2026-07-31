/**
 * GET /api/cron/purge-deleted-contacts
 *
 * ⚠️ **SUPERSEDED από το `/api/cron/purge-deleted-entities`**, που σαρώνει *όλους* τους
 * soft-deletable τύπους — και το `SOFT_DELETE_CONFIG.contact` δείχνει ήδη στην ίδια
 * `COLLECTIONS.CONTACTS`. Δηλωμένο στο `src/config/cron-schedule.ts` ως `enabled: false`
 * με `supersededBy`. **Δεν προγραμματίζεται.**
 *
 * Δεν διαγράφηκε επειδή ο αντικαταστάτης δεν έχει τρέξει ποτέ σε παραγωγή (κανένα cron
 * δεν έτρεξε 2026-05-09 → 2026-07-31). Αφαίρεση route + job μόνο αφού το
 * `purge-deleted-entities` δείξει επιτυχημένα check-ins — βλ. ADR-739 §Αποφάσεις.
 *
 * **Πυροκροτητής, όχι λογική** — η εκκαθάριση ζει στο
 * `lib/cron/jobs/purge-deleted-contacts.job.ts`.
 *
 * ⚠️ Το guard προστέθηκε 2026-07-31: το route έκανε **οριστική** διαγραφή χωρίς καμία
 * ταυτοποίηση. Επιβάλλεται από test.
 *
 * @module api/cron/purge-deleted-contacts
 * @enterprise ADR-191 pattern — Soft-delete lifecycle auto-purge
 * @see ADR-739
 */

import { type NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { purgeDeletedContacts } from '@/lib/cron/jobs/purge-deleted-contacts.job';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronPurgeDeletedContacts');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const report = await purgeDeletedContacts();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    const message = getErrorMessage(error, 'Contact purge failed');
    logger.error(`Contact purge cron failed: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
