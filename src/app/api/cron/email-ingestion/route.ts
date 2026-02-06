/**
 * 🏢 ENTERPRISE EMAIL INGESTION CRON ENDPOINT
 *
 * ADR-071: Enterprise Email Webhook Queue System
 *
 * This endpoint is triggered by Vercel Cron to process
 * emails from the ingestion queue.
 *
 * Configuration in vercel.json:
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-ingestion",
 *     "schedule": "* * * * *"
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

/**
 * POST /api/cron/email-ingestion
 *
 * Process pending emails from the queue.
 * Triggered by Vercel Cron every minute.
 *
 * @rateLimit SENSITIVE (20 req/min) - Cron job for email processing
 */
async function handlePOST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  // Verify authorization
  if (!verifyCronAuthorization(request)) {
    logger.warn('Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('Email ingestion cron triggered');

  try {
    // Process a batch of emails
    const result = await processEmailIngestionBatch();

    const elapsed = Date.now() - startTime;

    logger.info('Email ingestion cron completed', {
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      healthy: result.healthStatus.healthy,
      elapsedMs: elapsed,
    });

    // Log warnings if any
    if (result.healthStatus.warnings.length > 0) {
      logger.warn('Queue health warnings', {
        warnings: result.healthStatus.warnings,
      });
    }

    return NextResponse.json({
      ok: true,
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

    logger.error('Email ingestion cron error', {
      error: errorMessage,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: false,
      error: errorMessage,
      elapsedMs: elapsed,
    }, { status: 500 });
  }
}

export const POST = withSensitiveRateLimit(handlePOST);

/**
 * GET /api/cron/email-ingestion
 *
 * Health check and queue statistics.
 *
 * @rateLimit SENSITIVE (20 req/min) - Health check and queue statistics
 */
async function handleGET(request: NextRequest): Promise<Response> {
  // Verify authorization (optional for health check)
  const authorized = verifyCronAuthorization(request);

  try {
    const health = await getEmailIngestionQueueHealth();

    return NextResponse.json({
      ok: true,
      service: 'email-ingestion-worker',
      version: 'v1',
      authorized,
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
