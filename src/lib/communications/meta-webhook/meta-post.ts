/**
 * =============================================================================
 * META WEBHOOK POST INGESTION ENVELOPE — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for the incoming-event POST envelope shared by every
 * Meta webhook (Instagram / Messenger / WhatsApp). The envelope is identical
 * across platforms:
 *
 *   1. Read raw body + verify `X-Hub-Signature-256`.
 *   2. Parse JSON + guard on the expected `object` discriminator.
 *   3. Collect the pipeline messages (per-platform payload walk + CRM side effects).
 *   4. Enqueue them, then trigger the AI pipeline batch via `after()`.
 *   5. Always return 200 so Meta never retries.
 *
 * Only the per-platform payload walk differs — injected via `collectPipelineMessages`
 * (which also owns CRM storage / read receipts) and `feedToPipeline`. The pending
 * messages live in a local array per request (no module-level mutable state → no
 * cross-invocation race on warm serverless containers).
 *
 * @module lib/communications/meta-webhook/meta-post
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 * @enterprise ADR-134 - Post-response pipeline batch (Telegram pattern)
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { Logger } from '@/lib/telemetry';
import { verifyMetaWebhookSignature } from './meta-signature';
import { triggerPipelineBatchAfterResponse } from './meta-pipeline-batch';

/** Per-platform configuration for the shared Meta webhook POST envelope. */
export interface MetaWebhookPostConfig<TPayload extends { object?: string }, TMessage> {
  /** Module logger for the calling platform handler. */
  logger: Logger;
  /** Platform label for log lines + pipeline prefix (e.g. 'WhatsApp'). */
  platform: string;
  /** Expected `payload.object` discriminator (e.g. 'whatsapp_business_account'). */
  expectedObject: string;
  /**
   * Walk the parsed payload: perform per-platform side effects (CRM store, read
   * receipts, feedback handling) and return the messages to feed to the pipeline.
   */
  collectPipelineMessages: (payload: TPayload) => Promise<TMessage[]>;
  /** Enqueue a single collected message into the AI pipeline (awaited before `after()`). */
  feedToPipeline: (message: TMessage) => Promise<void>;
}

/**
 * Handle an incoming Meta webhook POST. Always resolves to a 200 response
 * (Meta retries on non-2xx), even on rejected signature or processing error.
 */
export async function handleMetaWebhookPost<TPayload extends { object?: string }, TMessage>(
  request: NextRequest,
  config: MetaWebhookPostConfig<TPayload, TMessage>
): Promise<NextResponse> {
  const { logger, platform, expectedObject, collectPipelineMessages, feedToPipeline } = config;

  try {
    // 1. Verify signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifyMetaWebhookSignature(rawBody, signature, logger)) {
      logger.warn(`${platform} webhook signature verification failed`);
      return NextResponse.json({ ok: true, rejected: true, reason: 'invalid_signature' });
    }

    // 2. Parse payload + guard on the object discriminator
    const payload = JSON.parse(rawBody) as TPayload;

    if (payload.object !== expectedObject) {
      logger.warn('Unexpected webhook object', { object: payload.object });
      return NextResponse.json({ ok: true });
    }

    // 3. Per-platform payload walk → messages destined for the pipeline
    const pipelineMessages = await collectPipelineMessages(payload);

    // 4. Feed to AI pipeline via after() — enqueue first, then batch after response
    if (pipelineMessages.length > 0) {
      for (const message of pipelineMessages) {
        await feedToPipeline(message);
      }
      triggerPipelineBatchAfterResponse(platform, logger);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error(`${platform} webhook processing error`, { error });
    // Return 200 even on error to prevent Meta from retrying
    return NextResponse.json({ ok: true, error: 'Processing error' });
  }
}
