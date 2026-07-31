/**
 * =============================================================================
 * Cron: File Purge — εκκαθάριση κάδου αρχείων + ορφανών PENDING/FAILED
 * =============================================================================
 *
 * **Πυροκροτητής, όχι λογική** — οι δύο φάσεις ζουν στο
 * `lib/cron/jobs/file-purge.job.ts`. Το route μένει για χειροκίνητη εκτέλεση· η
 * προγραμματισμένη περνά από το `/api/cron/dispatch` και καλεί τη συνάρτηση απευθείας.
 *
 * @module api/cron/file-purge
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 3.2)
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import { type NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { purgeFiles } from '@/lib/cron/jobs/file-purge.job';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronFilePurge');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const { trash, orphans } = await purgeFiles();
    return NextResponse.json({ success: true, trash, orphans });
  } catch (err) {
    const message = getErrorMessage(err, 'Purge cron failed');
    logger.error(`Cron purge error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
