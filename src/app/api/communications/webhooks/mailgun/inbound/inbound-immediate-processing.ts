/**
 * 🏢 MAILGUN INBOUND — «Respond Fast, Process After» (ADR-071 · ADR-080).
 *
 * Εξήχθη από το `route.ts` (CHECK 4: API route ≤300 γραμμές): η καταγραφή του αποτελέσματος της
 * ουράς και η άμεση επεξεργασία μέσα στο `after()`, αφού έχει απαντήσει το webhook.
 *
 * @module api/communications/webhooks/mailgun/inbound/inbound-immediate-processing
 */

import 'server-only';

import { after } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { processEmailIngestionBatch } from '@/server/comms/workers/email-ingestion-worker';

const logger = createModuleLogger('MAILGUN_INBOUND_WEBHOOK');

interface EnqueueOutcome {
  readonly status: string;
  readonly queueId?: string;
}

/** Μία γραμμή καταγραφής ανά κατάσταση της ουράς. */
export function logEnqueueResult(
  result: EnqueueOutcome,
  context: { readonly elapsedMs: number; readonly senderEmail: string; readonly recipients: string[] },
): void {
  const { elapsedMs } = context;
  if (result.status === 'queued') {
    logger.info('Email enqueued successfully', { queueId: result.queueId, elapsedMs, from: context.senderEmail });
  } else if (result.status === 'duplicate') {
    logger.info('Duplicate email detected, already in queue', { queueId: result.queueId, elapsedMs });
  } else if (result.status === 'routing_failed') {
    logger.warn('Email routing failed - no matching routing rule', { recipients: context.recipients, elapsedMs });
  } else {
    logger.error('Failed to enqueue email', { status: result.status, elapsedMs });
  }
}

/** 🤖 ADR-080: τα email τροφοδοτούν το ai_pipeline_queue — επεξεργάσου τα αμέσως για το Operator Inbox. */
async function runAIPipelineBatch(): Promise<void> {
  try {
    const { processAIPipelineBatch } = await import('@/server/ai/workers/ai-pipeline-worker');
    const pipelineResult = await processAIPipelineBatch();
    logger.info('after(): AI pipeline batch completed', {
      processed: pipelineResult.processed,
      failed: pipelineResult.failed,
      recovered: pipelineResult.recovered,
    });
  } catch (pipelineError) {
    // Non-blocking: daily cron will retry pipeline items
    logger.warn('after(): AI pipeline processing failed (cron will retry)', {
      error: getErrorMessage(pipelineError),
    });
  }
}

/**
 * 🏢 ENTERPRISE: "Respond Fast, Process After" pattern (Next.js 15 after())
 * Vercel Hobby plan limits cron to daily, so we trigger immediate processing
 * after responding to Mailgun. The daily cron serves as backup for retries.
 * Pattern used by: Salesforce Platform Events, SAP Event Mesh, Google Cloud Tasks
 */
export function scheduleImmediateProcessing(queueId: string | undefined): void {
  after(async () => {
    try {
      logger.info('after(): Starting immediate email processing', { queueId });
      const result = await processEmailIngestionBatch();
      logger.info('after(): Immediate processing completed', {
        processed: result.processed,
        failed: result.failed,
      });
      if (result.processed > 0) await runAIPipelineBatch();
    } catch (afterError) {
      // Non-fatal: daily cron will retry failed items
      logger.warn('after(): Immediate processing failed (cron will retry)', {
        error: getErrorMessage(afterError),
      });
    }
  });
}
