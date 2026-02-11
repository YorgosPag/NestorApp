/**
 * =============================================================================
 * WHATSAPP WEBHOOK HANDLER — ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming WhatsApp Cloud API webhook events:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming messages + status updates
 *
 * Security:
 * - Webhook signature verification (X-Hub-Signature-256) with App Secret
 * - Idempotent message processing (deterministic doc IDs)
 * - Rate limiting via withWebhookRateLimit
 *
 * @module api/communications/webhooks/whatsapp/handler
 * @enterprise ADR-174 - Meta Omnichannel Integration
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse, after } from 'next/server';
import { createHmac } from 'crypto';
import { storeWhatsAppMessage, updateMessageDeliveryStatus, extractMessageText } from './crm-adapter';
import { markWhatsAppMessageRead, sendWhatsAppMessage } from './whatsapp-client';
import type {
  WhatsAppWebhookPayload,
  WhatsAppChangeValue,
  WhatsAppMessage,
  WhatsAppContact,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WhatsAppWebhookHandler');

// ============================================================================
// GET — WEBHOOK VERIFICATION
// ============================================================================

/**
 * Meta sends a GET request when you configure the webhook URL.
 * We must respond with the hub.challenge value if the verify token matches.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export async function handleGET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    // Must return JUST the challenge string with 200 status
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('WhatsApp webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================================
// POST — INCOMING MESSAGES & STATUS UPDATES
// ============================================================================

/**
 * Handle incoming webhook events from WhatsApp Cloud API.
 *
 * IMPORTANT: Always return 200 to prevent Meta from retrying.
 * Meta retries on non-2xx responses.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature (security)
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(rawBody, signature)) {
      logger.warn('WhatsApp webhook signature verification failed');
      // Return 200 to prevent retries but log rejection
      return NextResponse.json({ ok: true, rejected: true, reason: 'invalid_signature' });
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('Unexpected webhook object', { object: payload.object });
      return NextResponse.json({ ok: true });
    }

    // 3. Clear pending pipeline messages from previous invocation
    pendingPipelineMessages.length = 0;

    // 4. Process each entry
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await processChangeValue(change.value);
        }
      }
    }

    // 5. Feed to AI pipeline via after() — same pattern as Telegram (ADR-134)
    // Enqueue first, then trigger batch processing after response is sent
    if (pendingPipelineMessages.length > 0) {
      const messagesToFeed = [...pendingPipelineMessages];
      pendingPipelineMessages.length = 0;

      // Enqueue pipeline items BEFORE after() — critical for race condition prevention
      for (const msg of messagesToFeed) {
        await feedWhatsAppToPipeline(msg);
      }

      // Trigger batch processing AFTER response is sent
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          logger.info('[WhatsApp->Pipeline] after(): batch complete', {
            processed: result.processed,
            failed: result.failed,
          });
        } catch (error) {
          // Non-fatal: daily cron will retry pipeline items
          logger.warn('[WhatsApp->Pipeline] after(): pipeline batch failed (cron will retry)', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('WhatsApp webhook processing error', { error });
    // Return 200 even on error to prevent Meta from retrying
    return NextResponse.json({ ok: true, error: 'Processing error' });
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processChangeValue(value: WhatsAppChangeValue): Promise<void> {
  // Handle status updates (sent, delivered, read)
  if (value.statuses && value.statuses.length > 0) {
    for (const status of value.statuses) {
      await updateMessageDeliveryStatus(status.id, status.status);
    }
  }

  // Handle incoming messages
  if (value.messages && value.messages.length > 0) {
    for (const message of value.messages) {
      await processIncomingMessage(message, value.contacts);
    }
  }

  // Handle errors from Meta
  if (value.errors && value.errors.length > 0) {
    for (const error of value.errors) {
      logger.error('WhatsApp API error from webhook', {
        code: error.code,
        title: error.title,
        message: error.message,
      });
    }
  }
}

/** Tracks messages that need pipeline processing (for after() batch) */
const pendingPipelineMessages: Array<{
  phoneNumber: string;
  senderName: string;
  messageText: string;
  messageId: string;
}> = [];

async function processIncomingMessage(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[] | undefined
): Promise<void> {
  // Find matching contact info
  const contact = contacts?.find(c => c.wa_id === message.from);

  logger.info('Processing WhatsApp message', {
    type: message.type,
    from: message.from.slice(-4), // Last 4 digits only (privacy)
    id: message.id,
  });

  // Skip reaction messages for now (Phase 2)
  if (message.type === 'reaction') {
    logger.info('Skipping reaction message (Phase 2)');
    return;
  }

  // ── Handle interactive button replies (suggestions + feedback) ──
  if (message.type === 'interactive' && message.interactive) {
    const buttonId = message.interactive.button_reply?.id ?? '';
    const buttonTitle = message.interactive.button_reply?.title ?? '';

    // Feedback buttons (👍/👎) — record and acknowledge
    if (buttonId.startsWith('fb_')) {
      await handleFeedbackButton(buttonId, message.from);
      await markWhatsAppMessageRead(message.id);
      return;
    }

    // Suggestion buttons — treat as new user message, feed to pipeline
    if (buttonId.startsWith('sug_')) {
      await markWhatsAppMessageRead(message.id);
      sendWhatsAppMessage(message.from, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...').catch(() => {});
      pendingPipelineMessages.push({
        phoneNumber: message.from,
        senderName: contact?.profile?.name ?? message.from,
        messageText: buttonTitle,
        messageId: message.id,
      });
      return;
    }
  }

  // Store in CRM
  const result = await storeWhatsAppMessage(message, contact, 'inbound');

  if (result.messageDocId) {
    // Mark as read (sends blue checkmarks)
    await markWhatsAppMessageRead(message.id);
    logger.info('WhatsApp message processed', {
      docId: result.messageDocId,
      conversationId: result.conversationId,
      isNew: result.isNewConversation,
    });
  }

  // Track message for pipeline processing (will be fed via after())
  const messageText = extractMessageText(message);
  if (messageText.trim().length > 0) {
    // Send immediate "processing" acknowledgment (non-blocking)
    sendWhatsAppMessage(message.from, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...').catch(() => {
      // Non-fatal — don't block pipeline feed if ack fails
    });

    pendingPipelineMessages.push({
      phoneNumber: message.from,
      senderName: contact?.profile?.name ?? message.from,
      messageText,
      messageId: message.id,
    });
  }
}

// ============================================================================
// FEEDBACK HANDLER
// ============================================================================

/**
 * Handle feedback button taps (👍/👎).
 * Button ID format: fb_{feedbackDocId}_{up|down}
 */
async function handleFeedbackButton(buttonId: string, senderPhone: string): Promise<void> {
  try {
    // Parse: fb_{feedbackDocId}_{up|down}
    const parts = buttonId.split('_');
    const sentiment = parts[parts.length - 1]; // 'up' or 'down'
    const feedbackDocId = parts.slice(1, -1).join('_');

    if (!feedbackDocId || !sentiment) {
      logger.warn('Invalid feedback button ID', { buttonId });
      return;
    }

    const isPositive = sentiment === 'up';

    // Record feedback in Firestore
    const { getFeedbackService } = await import(
      '@/services/ai-pipeline/feedback-service'
    );
    await getFeedbackService().updateRating(feedbackDocId, isPositive ? 'positive' : 'negative');

    // Send acknowledgment
    const ackText = isPositive
      ? '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!'
      : '\u{1F44E} \u0398\u03B1 \u03C0\u03C1\u03BF\u03C3\u03C0\u03B1\u03B8\u03AE\u03C3\u03C9 \u03BD\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE!';
    await sendWhatsAppMessage(senderPhone, ackText);

    logger.info('WhatsApp feedback recorded', { feedbackDocId, sentiment, phone: senderPhone.slice(-4) });
  } catch (error) {
    // Non-fatal
    logger.warn('WhatsApp feedback handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// PIPELINE FEED
// ============================================================================

/**
 * Feed a WhatsApp message to the AI Pipeline.
 *
 * Awaitable to ensure enqueue completes before after() batch processing.
 * Non-fatal: catches all errors so pipeline failure never breaks the webhook.
 * Uses dynamic import to avoid circular dependency issues.
 *
 * @see ADR-174 (Meta Omnichannel — WhatsApp)
 * @see ADR-134 pattern (Telegram pipeline feed)
 */
async function feedWhatsAppToPipeline(msg: {
  phoneNumber: string;
  senderName: string;
  messageText: string;
  messageId: string;
}): Promise<void> {
  const companyId = process.env.DEFAULT_COMPANY_ID
    ?? process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
    ?? 'default';

  try {
    const { WhatsAppChannelAdapter } = await import(
      '@/services/ai-pipeline/channel-adapters/whatsapp-channel-adapter'
    );

    const result = await WhatsAppChannelAdapter.feedToPipeline({
      phoneNumber: msg.phoneNumber,
      senderName: msg.senderName,
      messageText: msg.messageText,
      messageId: msg.messageId,
      companyId,
    });

    if (result.enqueued) {
      logger.info('[WhatsApp->Pipeline] Enqueued', { requestId: result.requestId });
    } else {
      logger.warn('[WhatsApp->Pipeline] Failed', { error: result.error });
    }
  } catch (error) {
    // Non-fatal: pipeline failure should never break the WhatsApp webhook
    logger.warn('[WhatsApp->Pipeline] Non-fatal error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header using HMAC-SHA256 with App Secret.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();

  // If no app secret configured, allow with warning (temporary until META_APP_SECRET is set)
  // TODO: Remove this fallback once META_APP_SECRET is configured on Vercel
  if (!appSecret) {
    logger.warn('META_APP_SECRET not configured — skipping signature verification (TEMPORARY)');
    return true;
  }

  if (!signature) {
    logger.warn('No X-Hub-Signature-256 header present');
    return false;
  }

  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  try {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    // Fallback (should never happen in Node.js)
    return signature === expectedSignature;
  }
}
