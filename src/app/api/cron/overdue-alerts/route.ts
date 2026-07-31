/**
 * 🏢 Overdue Alerts Cron Endpoint — ADR-234 Phase 5
 *
 * **Πυροκροτητής, όχι λογική** — η σάρωση ζει στο `OverdueAlertService`, ο
 * προσαρμογέας στο `lib/cron/jobs/overdue-alerts.job.ts`.
 *
 * ⚠️ Η μη εξουσιοδοτημένη κλήση επιστρέφει `200` με `authorized: false` —
 * **σκόπιμα**, ως liveness probe. Καμία σάρωση δεν τρέχει και κανένα δεδομένο δεν
 * επιστρέφεται· διατηρημένη συμπεριφορά.
 *
 * @module api/cron/overdue-alerts
 * @see ADR-739 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (03:00 Europe/Athens)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { runOverdueAlerts } from '@/lib/cron/jobs/overdue-alerts.job';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('OVERDUE_ALERTS_CRON');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function handleGET(request: NextRequest): Promise<Response> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({
      ok: true,
      service: 'overdue-alerts',
      authorized: false,
      message: 'Health check — authorization required for scan',
    });
  }

  const startTime = Date.now();
  logger.info('Overdue alerts scan triggered');

  try {
    const result = await runOverdueAlerts();
    const elapsedMs = Date.now() - startTime;

    logger.info('Overdue alerts scan completed', { summary: result.summary, elapsedMs });

    return NextResponse.json({ ok: true, summary: result.summary, ...result.metrics, elapsedMs });
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error('Overdue alerts scan error', { error: errorMessage, elapsedMs });

    return NextResponse.json({ ok: false, error: errorMessage, elapsedMs }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(handleGET);
