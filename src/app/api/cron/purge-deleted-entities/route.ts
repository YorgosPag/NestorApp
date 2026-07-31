/**
 * GET /api/cron/purge-deleted-entities
 *
 * **Πυροκροτητής, όχι λογική.** Η εκκαθάριση ζει στο
 * `lib/cron/jobs/purge-deleted-entities.job.ts` — ίδιο μοτίβο με το `oauth-cleanup`
 * (ADR-738 §10): η απάντηση στο «τι σβήνεται και πότε;» δεν πρέπει να απαιτεί ανάγνωση
 * δύο αρχείων.
 *
 * Το route μένει για **χειροκίνητη** εκτέλεση και διάγνωση. Η προγραμματισμένη εκτέλεση
 * περνά από το `/api/cron/dispatch`, που καλεί τη συνάρτηση απευθείας — χωρίς HTTP.
 *
 * ⚠️ ΤΟ GUARD ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ. Καλεί `executeDeletion()` — **οριστική** διαγραφή
 * με cascade. Μέχρι 2026-07-31 δεν είχε καθόλου ταυτοποίηση: το κάλυπτε κατά λάθος το
 * bot-block του `middleware.ts`, που όμως φιλτράρει user-agent — αλλάζει σε ένα
 * δευτερόλεπτο και **δεν είναι εξουσιοδότηση**. Επιβάλλεται από
 * `src/lib/cron/__tests__/cron-route-contract.test.ts`.
 *
 * @module api/cron/purge-deleted-entities
 * @enterprise ADR-281 — SSOT Soft-Delete System
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import { type NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { purgeDeletedEntities } from '@/lib/cron/jobs/purge-deleted-entities.job';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronPurgeDeletedEntities');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const report = await purgeDeletedEntities();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    const message = getErrorMessage(error, 'Entity purge failed');
    logger.error(`Entity purge error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
