/**
 * =============================================================================
 * META WEBHOOK → AI PIPELINE BATCH TRIGGER — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for the post-response AI pipeline batch trigger used by
 * every Meta webhook handler. After the platform handler has enqueued its
 * pipeline items, it schedules `processAIPipelineBatch()` via Next.js `after()`
 * so the batch runs once the 200 response is already flushed (webhook stays fast,
 * Meta never retries). Failures are non-fatal — the daily cron retries.
 *
 * The block was byte-identical across Instagram / Messenger / WhatsApp except for
 * the log prefix, which is injected.
 *
 * @module lib/communications/meta-webhook/meta-pipeline-batch
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-134 - Post-response pipeline batch (Telegram pattern)
 */

import { after } from 'next/server';
import type { Logger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

/**
 * Schedule the AI pipeline batch to run after the webhook response is sent.
 *
 * MUST be called within the request scope (before returning the response), so
 * that `after()` binds to the current request.
 *
 * @param logPrefix Platform label for log lines (e.g. 'WhatsApp' → '[WhatsApp->Pipeline]').
 * @param logger    Module logger for the calling platform handler.
 */
export function triggerPipelineBatchAfterResponse(logPrefix: string, logger: Logger): void {
  after(async () => {
    try {
      const { processAIPipelineBatch } = await import(
        '@/server/ai/workers/ai-pipeline-worker'
      );
      const result = await processAIPipelineBatch();
      logger.info(`[${logPrefix}->Pipeline] after(): batch complete`, {
        processed: result.processed,
        failed: result.failed,
      });
    } catch (error) {
      // Non-fatal: daily cron will retry pipeline items
      logger.warn(`[${logPrefix}->Pipeline] after(): pipeline batch failed (cron will retry)`, {
        error: getErrorMessage(error),
      });
    }
  });
}
