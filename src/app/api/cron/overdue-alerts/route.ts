/**
 * 🏢 Overdue Alerts Cron Endpoint — ADR-234 Phase 5
 *
 * Daily Vercel Cron that scans for overdue installments
 * and creates notification documents.
 *
 * Configuration in vercel.json:
 * ```json
 * { "path": "/api/cron/overdue-alerts", "schedule": "0 0 * * *" }
 * ```
 *
 * @module api/cron/overdue-alerts
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { OverdueAlertService } from '@/services/overdue-alert.service';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('OVERDUE_ALERTS_CRON');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// =============================================================================
// CRON AUTH — reuse pattern from email-ingestion
// =============================================================================

function verifyCronAuthorization(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn('CRON_SECRET not configured - allowing unauthenticated access');
    return true;
  }

  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === cronSecret) {
    return true;
  }

  return false;
}

// =============================================================================
// GET /api/cron/overdue-alerts
// =============================================================================

async function handleGET(request: NextRequest): Promise<Response> {
  const authorized = verifyCronAuthorization(request);

  if (!authorized) {
    return NextResponse.json({
      ok: true,
      service: 'overdue-alerts',
      authorized: false,
      message: 'Health check — authorization required for scan',
    });
  }

  const startTime = Date.now();
  const userAgent = request.headers.get('user-agent') || '';
  const trigger = userAgent.includes('vercel-cron') ? 'vercel-cron' : 'api-call';

  logger.info('Overdue alerts scan triggered', { trigger });

  try {
    const result = await OverdueAlertService.scanAndNotify();
    const elapsedMs = Date.now() - startTime;

    logger.info('Overdue alerts scan completed', { ...result, trigger, elapsedMs });

    return NextResponse.json({
      ok: true,
      trigger,
      ...result,
      elapsedMs,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error('Overdue alerts scan error', { error: errorMessage, trigger, elapsedMs });

    return NextResponse.json({
      ok: false,
      trigger,
      error: errorMessage,
      elapsedMs,
    }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(handleGET);
