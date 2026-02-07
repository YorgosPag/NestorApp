/**
 * =============================================================================
 * AI PIPELINE CRON ENDPOINT
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Scheduled trigger for AI pipeline queue processing.
 * Same proven pattern as email-ingestion cron (ADR-071).
 *
 * Triggers:
 * - Vercel Cron (GET with Authorization header)
 * - Manual API call (POST with Authorization)
 * - Health check (GET without auth — liveness probe)
 *
 * Configuration in vercel.json:
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/ai-pipeline",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 * ```
 *
 * @module api/cron/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see api/cron/email-ingestion (same pattern)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  processAIPipelineBatch,
  getAIPipelineQueueHealth,
} from '@/server/ai/workers/ai-pipeline-worker';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

const logger = createModuleLogger('AI_PIPELINE_CRON');

// ============================================================================
// AUTHORIZATION
// ============================================================================

/**
 * Verify Vercel Cron authorization
 *
 * Vercel sends CRON_SECRET in Authorization header for cron jobs.
 */
function verifyCronAuthorization(request: NextRequest): boolean {
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

// ============================================================================
// SHARED BATCH PROCESSING LOGIC (DRY)
// ============================================================================

type CronTrigger = 'vercel-cron' | 'manual-post' | 'api-call';

async function executeBatchProcessing(trigger: CronTrigger): Promise<Response> {
  const startTime = Date.now();

  logger.info('AI pipeline batch triggered', { trigger });

  try {
    const result = await processAIPipelineBatch();

    const elapsed = Date.now() - startTime;

    logger.info('AI pipeline batch completed', {
      trigger,
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: true,
      trigger,
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
      queue: result.queueStats,
      elapsedMs: elapsed,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('AI pipeline batch error', {
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

// ============================================================================
// GET /api/cron/ai-pipeline
//
// Vercel Cron sends GET requests with Authorization header.
// - Authorized (cron/admin) → Process pipeline queue batch
// - Unauthenticated → Health check / liveness probe only
//
// @rateLimit SENSITIVE (20 req/min)
// ============================================================================

async function handleGET(request: NextRequest): Promise<Response> {
  const authorized = verifyCronAuthorization(request);

  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCron = userAgent.includes('vercel-cron');

  if (authorized) {
    const trigger: CronTrigger = isVercelCron ? 'vercel-cron' : 'api-call';
    return executeBatchProcessing(trigger);
  }

  // Unauthenticated → health check only (liveness probe)
  try {
    const health = await getAIPipelineQueueHealth();

    return NextResponse.json({
      ok: true,
      service: 'ai-pipeline-worker',
      version: 'v1',
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
      service: 'ai-pipeline-worker',
      error: errorMessage,
    }, { status: 500 });
  }
}

export const GET = withSensitiveRateLimit(handleGET);

// ============================================================================
// POST /api/cron/ai-pipeline
//
// Manual trigger for batch processing (admin tools, API calls).
// Requires authorization.
//
// @rateLimit SENSITIVE (20 req/min)
// ============================================================================

async function handlePOST(request: NextRequest): Promise<Response> {
  if (!verifyCronAuthorization(request)) {
    logger.warn('Unauthorized POST to AI pipeline cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return executeBatchProcessing('manual-post');
}

export const POST = withSensitiveRateLimit(handlePOST);
