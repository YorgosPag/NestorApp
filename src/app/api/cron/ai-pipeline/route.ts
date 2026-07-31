/**
 * =============================================================================
 * AI PIPELINE CRON ENDPOINT
 * =============================================================================
 *
 * GET  → με εξουσιοδότηση: επεξεργασία παρτίδας· χωρίς: liveness probe.
 * POST → χειροκίνητη ενεργοποίηση (απαιτεί εξουσιοδότηση).
 *
 * ⚠️ **Δεν προγραμματίζεται σήμερα.** Το route υπάρχει από την αρχή αλλά δεν μπήκε
 * ποτέ στο `vercel.json` — άρα δεν έτρεξε ούτε όσο ζούσε το Vercel. Δηλωμένο στο
 * `src/config/cron-schedule.ts` ως `enabled: false` / `never-scheduled`, ώστε να είναι
 * **ορατό** αντί να ξαναξεχαστεί (ADR-739 §Αποφάσεις).
 *
 * ⚠️ **Το διαγνωστικό απαιτεί πλέον εξουσιοδότηση.** Μέχρι 2026-07-31 το μη
 * ταυτοποιημένο σκέλος επέστρεφε `intakeSubject` και `intakeSender` — δηλαδή **θέματα
 * και διευθύνσεις αποστολέων πραγματικών μηνυμάτων σε οποιονδήποτε καλούσε**. Το
 * κάλυπτε μόνο το bot-block του `middleware.ts`, που φιλτράρει user-agent και δεν είναι
 * εξουσιοδότηση. Το liveness probe χρειάζεται να ξέρει **αν** η ουρά είναι υγιής, όχι
 * **τι** περιέχει.
 *
 * @module api/cron/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see api/cron/email-ingestion (same pattern)
 * @see ADR-739 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { collectAiPipelineDiagnostic } from '@/lib/cron/ai-pipeline-diagnostic';
import { runAiPipeline } from '@/lib/cron/jobs/ai-pipeline.job';
import { getAIPipelineQueueHealth } from '@/server/ai/workers/ai-pipeline-worker';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('AI_PIPELINE_CRON');

export const maxDuration = 60;

/** Επεξεργασία παρτίδας — η λογική ζει στο `lib/cron/jobs/ai-pipeline.job.ts`. */
async function executeBatchProcessing(trigger: 'manual-post' | 'api-call'): Promise<Response> {
  const startTime = Date.now();
  logger.info('AI pipeline batch triggered', { trigger });

  try {
    const result = await runAiPipeline();
    const elapsedMs = Date.now() - startTime;

    logger.info('AI pipeline batch completed', { trigger, ...result.metrics, elapsedMs });

    // Το διαγνωστικό μόνο όταν υπάρχει κάτι να διαγνωστεί.
    const failedCount = result.metrics?.failed ?? 0;
    const diagnostic = failedCount > 0 ? await collectAiPipelineDiagnostic() : undefined;

    return NextResponse.json({
      ok: true,
      trigger,
      ...result.metrics,
      summary: result.summary,
      diagnostic,
      elapsedMs,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error('AI pipeline batch error', { trigger, error: errorMessage, elapsedMs });

    return NextResponse.json(
      { ok: false, trigger, error: errorMessage, elapsedMs },
      { status: 500 }
    );
  }
}

async function handleGET(request: NextRequest): Promise<Response> {
  if (verifyCronAuthorization(request)) {
    return executeBatchProcessing('api-call');
  }

  // Μη ταυτοποιημένος → **μόνο** liveness probe. Καμία πληροφορία περιεχομένου.
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
    return NextResponse.json(
      { ok: false, service: 'ai-pipeline-worker', error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export const GET = withSensitiveRateLimit(handleGET);

async function handlePOST(request: NextRequest): Promise<Response> {
  if (!verifyCronAuthorization(request)) {
    logger.warn('Unauthorized POST to AI pipeline cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return executeBatchProcessing('manual-post');
}

export const POST = withSensitiveRateLimit(handlePOST);
