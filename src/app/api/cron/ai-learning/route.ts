/**
 * =============================================================================
 * AI LEARNING CRON — ημερήσια εξαγωγή μοτίβων + εκκαθάριση
 * =============================================================================
 *
 * **Πυροκροτητής, όχι λογική** — τα πέντε βήματα ζουν στο
 * `lib/cron/jobs/ai-learning.job.ts`. Το route μένει για χειροκίνητη εκτέλεση· η
 * προγραμματισμένη περνά από το `/api/cron/dispatch` και καλεί τη συνάρτηση απευθείας.
 *
 * @route GET /api/cron/ai-learning
 * @see ADR-173 (AI Self-Improvement System)
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import { NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { runAiLearning } from '@/lib/cron/jobs/ai-learning.job';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('CRON_AI_LEARNING');

export const maxDuration = 60;

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startTime = Date.now();

  try {
    const result = await runAiLearning();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      summary: result.summary,
      ...result.metrics,
      durationMs,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const durationMs = Date.now() - startTime;

    logger.error('AI learning cron failed', { error: errorMessage, durationMs });

    return NextResponse.json(
      { success: false, error: errorMessage, durationMs },
      { status: 500 }
    );
  }
}

export const GET = withSensitiveRateLimit(handleGET);
