/**
 * JOB: ai-learning — καθημερινή εξαγωγή μοτίβων και εκκαθάριση.
 *
 * Πέντε διαδοχικά βήματα, **σειριακά και σκόπιμα**: το βήμα 2 (εκκαθάριση μοτίβων
 * χαμηλής ποιότητας) πρέπει να δει ό,τι παρήγαγε το βήμα 1, και το βήμα 4
 * (ανυπολογισμός ποσοστών) πρέπει να δει το αποτέλεσμα της εκκαθάρισης.
 * Παραλληλοποίηση εδώ θα έδινε ποσοστά υπολογισμένα πάνω σε μισοκαθαρισμένα δεδομένα.
 *
 * @module lib/cron/jobs/ai-learning
 * @see ADR-173 (AI Self-Improvement System)
 */

import { getLearningService } from '@/services/ai-pipeline/learning-service';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { getToolAnalyticsService } from '@/services/ai-pipeline/tool-analytics-service';
import { getChatHistoryService } from '@/services/ai-pipeline/chat-history-service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('CRON_AI_LEARNING');

/** Πλήθος στοιχείων ανατροφοδότησης ανά εκτέλεση. */
const FEEDBACK_BATCH_SIZE = 50;

export async function runAiLearning(): Promise<CronJobResult> {
  logger.info('AI learning cron started');

  const learningService = getLearningService();
  const patternsExtracted = await learningService.extractPatternsFromFeedback(FEEDBACK_BATCH_SIZE);
  const lowQualityPatternsDeleted = await learningService.cleanupLowQuality();

  const staleFeedbackDeleted = await getFeedbackService().cleanupStale();

  await getToolAnalyticsService().recomputeRates();

  const chatHistoryCleaned = await getChatHistoryService().cleanupOldHistory();

  const metrics = {
    patternsExtracted,
    lowQualityPatternsDeleted,
    staleFeedbackDeleted,
    chatHistoryCleaned,
  };

  logger.info('AI learning cron completed', metrics);

  return {
    summary: `patterns +${patternsExtracted}, cleaned ${lowQualityPatternsDeleted + staleFeedbackDeleted + chatHistoryCleaned}`,
    metrics,
  };
}
