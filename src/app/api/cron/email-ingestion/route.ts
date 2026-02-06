/**
 * 🏢 ENTERPRISE EMAIL INGESTION CRON ENDPOINT
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * This endpoint is triggered by Vercel Cron to process
 * emails from the ingestion queue.
 *
 * 🏢 IMPORTANT: Vercel Cron sends GET requests (not POST).
 * The GET handler processes the queue when authorized (cron trigger),
 * and returns health check when unauthenticated (liveness probe).
 * POST is available for manual/API triggers.
 *
 * Configuration in vercel.json:
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-ingestion",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * ```
 *
 * @module api/cron/email-ingestion
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  processEmailIngestionBatch,
  getEmailIngestionQueueHealth,
} from '@/server/comms/workers/email-ingestion-worker';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

const logger = createModuleLogger('EMAIL_INGESTION_CRON');

/**
 * Verify Vercel Cron authorization
 *
 * Vercel sends CRON_SECRET in Authorization header for cron jobs.
 */
function verifyCronAuthorization(request: NextRequest): boolean {
  // Check for Vercel cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If no secret configured, allow all (for development)
  if (!cronSecret) {
    logger.warn('CRON_SECRET not configured - allowing unauthenticated access');
    return true;
  }

  // Verify Bearer token
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also check X-Cron-Secret header (alternative)
  const cronSecretHeader = request.headers.get('x-cron-secret');
  if (cronSecretHeader === cronSecret) {
    return true;
  }

  return false;
}

// =============================================================================
// 🏢 ENTERPRISE: Shared batch processing logic (DRY)
// Used by both GET (Vercel Cron) and POST (manual/API trigger)
// Pattern: SAP Job Scheduler / Salesforce Scheduled Apex
// =============================================================================

type CronTrigger = 'vercel-cron' | 'manual-post' | 'api-call';

async function executeBatchProcessing(trigger: CronTrigger): Promise<Response> {
  const startTime = Date.now();

  logger.info('Email ingestion batch triggered', { trigger });

  try {
    const result = await processEmailIngestionBatch();

    const elapsed = Date.now() - startTime;

    logger.info('Email ingestion batch completed', {
      trigger,
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      healthy: result.healthStatus.healthy,
      elapsedMs: elapsed,
    });

    if (result.healthStatus.warnings.length > 0) {
      logger.warn('Queue health warnings', {
        trigger,
        warnings: result.healthStatus.warnings,
      });
    }

    return NextResponse.json({
      ok: true,
      trigger,
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      health: {
        healthy: result.healthStatus.healthy,
        warnings: result.healthStatus.warnings,
        stats: result.healthStatus.stats,
      },
      elapsedMs: elapsed,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Email ingestion batch error', {
      trigger,
      error: errorMessage,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: false,
      trigger,
      error: errorMessage,
      elapsedMs: elapsed,
    }, { status: 500 });
  }
}

// =============================================================================
// 🏢 GET /api/cron/email-ingestion
//
// Vercel Cron sends GET requests with Authorization header.
// - Authorized (cron/admin) → Process email queue batch
// - Unauthenticated → Health check / liveness probe only
//
// @rateLimit SENSITIVE (20 req/min)
// =============================================================================

async function handleGET(request: NextRequest): Promise<Response> {
  const authorized = verifyCronAuthorization(request);

  // 🏢 ENTERPRISE: Detect Vercel Cron via User-Agent (additional signal)
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCron = userAgent.includes('vercel-cron');

  if (authorized) {
    // Vercel Cron trigger OR authorized API call → process batch
    const trigger: CronTrigger = isVercelCron ? 'vercel-cron' : 'api-call';
    return executeBatchProcessing(trigger);
  }

  // Unauthenticated → health check only (liveness probe)
  try {
    const health = await getEmailIngestionQueueHealth();

    return NextResponse.json({
      ok: true,
      service: 'email-ingestion-worker',
      version: 'v2',
      authorized: false,
      health: {
        healthy: health.healthy,
        warnings: health.warnings,
        stats: health.stats,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      ok: false,
      service: 'email-ingestion-worker',
      error: errorMessage,
    }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(handleGET);

// =============================================================================
// 🏢 POST /api/cron/email-ingestion
//
// Manual trigger for batch processing (admin tools, API calls).
// Requires authorization.
//
// @rateLimit SENSITIVE (20 req/min)
// =============================================================================

async function handlePOST(request: NextRequest): Promise<Response> {
  if (!verifyCronAuthorization(request)) {
    logger.warn('Unauthorized POST cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return executeBatchProcessing('manual-post');
}

export const POST = withSensitiveRateLimit(handlePOST);
