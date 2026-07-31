/**
 * =============================================================================
 * CRON: ONBOARDING REMINDER — ADR-326 Phase 8
 * =============================================================================
 *
 * **Πυροκροτητής, όχι λογική** — η σάρωση και η σύνθεση του email ζουν στο
 * `lib/cron/jobs/onboarding-reminder.job.ts`. Το route μένει για χειροκίνητη εκτέλεση.
 *
 * ⚠️ Η μη εξουσιοδοτημένη κλήση επιστρέφει `200` με `authorized: false` — **σκόπιμα**,
 * ως liveness probe· διατηρημένη συμπεριφορά, όχι διαρροή (καμία σάρωση δεν τρέχει).
 *
 * @module api/cron/onboarding-reminder
 * @enterprise ADR-326 Phase 8
 * @see ADR-739 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { sendOnboardingReminders } from '@/lib/cron/jobs/onboarding-reminder.job';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ONBOARDING_REMINDER_CRON');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({
      ok: true,
      service: 'onboarding-reminder',
      authorized: false,
      message: 'Health check — authorization required for scan',
    });
  }

  const startTime = Date.now();
  logger.info('Onboarding reminder scan triggered');

  try {
    const result = await sendOnboardingReminders();
    const elapsedMs = Date.now() - startTime;

    logger.info('Onboarding reminder scan completed', { ...result, elapsedMs });
    return NextResponse.json({ ok: true, ...result, elapsedMs });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    logger.error('Onboarding reminder cron failed', { errorMessage });
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
