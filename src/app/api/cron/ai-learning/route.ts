/**
 * =============================================================================
 * AI LEARNING CRON — Daily Pattern Extraction & Cleanup
 * =============================================================================
 *
 * Runs daily via Vercel Cron:
 *   1. Extract patterns from rated feedback (max 50 items)
 *   2. Cleanup low-quality patterns (score < 0.3, older than 7 days)
 *   3. Cleanup stale feedback (null rating, older than 48h)
 *   4. Recompute tool analytics success rates
 *
 * @route GET /api/cron/ai-learning
 * @see ADR-173 (AI Self-Improvement System)
 */

import { NextResponse } from 'next/server';
import { getLearningService } from '@/services/ai-pipeline/learning-service';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { getToolAnalyticsService } from '@/services/ai-pipeline/tool-analytics-service';
import { getChatHistoryService } from '@/services/ai-pipeline/chat-history-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('CRON_AI_LEARNING');

export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();

  // Verify cron authorization (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('AI learning cron started');

  const results: Record<string, unknown> = {};

  try {
    // 1. Extract patterns from rated feedback
    const learningService = getLearningService();
    const patternsExtracted = await learningService.extractPatternsFromFeedback(50);
    results.patternsExtracted = patternsExtracted;

    // 2. Cleanup low-quality patterns
    const lowQualityDeleted = await learningService.cleanupLowQuality();
    results.lowQualityPatternsDeleted = lowQualityDeleted;

    // 3. Cleanup stale feedback (no rating after 48h)
    const feedbackService = getFeedbackService();
    const staleFeedbackDeleted = await feedbackService.cleanupStale();
    results.staleFeedbackDeleted = staleFeedbackDeleted;

    // 4. Recompute tool analytics success rates
    const analyticsService = getToolAnalyticsService();
    await analyticsService.recomputeRates();
    results.analyticsRecomputed = true;

    // 5. Cleanup old chat history (bonus — already existed in chat-history-service)
    const chatHistoryService = getChatHistoryService();
    const chatHistoryCleaned = await chatHistoryService.cleanupOldHistory();
    results.chatHistoryCleaned = chatHistoryCleaned;

    const durationMs = Date.now() - startTime;
    results.durationMs = durationMs;

    logger.info('AI learning cron completed', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startTime;

    logger.error('AI learning cron failed', {
      error: errorMessage,
      durationMs,
      partialResults: results,
    });

    return NextResponse.json({
      success: false,
      error: errorMessage,
      durationMs,
      partialResults: results,
    }, { status: 500 });
  }
}
