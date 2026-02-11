/**
 * =============================================================================
 * MESSENGER WEBHOOK HANDLER — ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming Facebook Messenger Platform webhook events:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming messages, delivery receipts, read receipts, postbacks
 *
 * Security:
 * - Webhook signature verification (X-Hub-Signature-256) with META_APP_SECRET
 * - Idempotent message processing (deterministic doc IDs)
 * - Rate limiting via withWebhookRateLimit
 *
 * @module api/communications/webhooks/messenger/handler
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse, after } from 'next/server';
import { createHmac } from 'crypto';
import { storeMessengerMessage, extractMessengerMessageText } from './crm-adapter';
import { sendMessengerMessage, sendMessengerQuickReplies, markMessengerSeen } from './messenger-client';
import type {
  MessengerWebhookPayload,
  MessengerMessagingEvent,
  MessengerMessage,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessengerWebhookHandler');

// ============================================================================
// GET — WEBHOOK VERIFICATION
// ============================================================================

/**
 * Meta sends a GET request when you configure the webhook URL.
 * We must respond with the hub.challenge value if the verify token matches.
 *
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#verification
 */
export async function handleGET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Messenger webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('Messenger webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================================
// POST — INCOMING MESSAGES & EVENTS
// ============================================================================

/**
 * Handle incoming webhook events from Messenger Platform.
 *
 * IMPORTANT: Always return 200 to prevent Meta from retrying.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Messenger webhook signature verification failed');
      return NextResponse.json({ ok: true, rejected: true, reason: 'invalid_signature' });
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody) as MessengerWebhookPayload;

    if (payload.object !== 'page') {
      logger.warn('Unexpected webhook object', { object: payload.object });
      return NextResponse.json({ ok: true });
    }

    // 3. Clear pending pipeline messages
    pendingPipelineMessages.length = 0;

    // 4. Process each entry
    for (const entry of payload.entry) {
      for (const event of entry.messaging) {
        await processMessagingEvent(event);
      }
    }

    // 5. Feed to AI pipeline via after()
    if (pendingPipelineMessages.length > 0) {
      const messagesToFeed = [...pendingPipelineMessages];
      pendingPipelineMessages.length = 0;

      // Enqueue pipeline items BEFORE after()
      for (const msg of messagesToFeed) {
        await feedMessengerToPipeline(msg);
      }

      // Trigger batch processing AFTER response is sent
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          logger.info('[Messenger->Pipeline] after(): batch complete', {
            processed: result.processed,
            failed: result.failed,
          });
        } catch (error) {
          logger.warn('[Messenger->Pipeline] after(): pipeline batch failed (cron will retry)', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Messenger webhook processing error', { error });
    return NextResponse.json({ ok: true, error: 'Processing error' });
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/** Tracks messages that need pipeline processing (for after() batch) */
const pendingPipelineMessages: Array<{
  psid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}> = [];

async function processMessagingEvent(event: MessengerMessagingEvent): Promise<void> {
  const psid = event.sender.id;

  // Skip delivery confirmations and read receipts
  if (event.delivery || event.read) {
    return;
  }

  // Handle postback (Get Started / Persistent Menu)
  if (event.postback) {
    logger.info('Messenger postback received', {
      psid: psid.slice(-4),
      payload: event.postback.payload,
    });
    // Treat postback text as a regular message
    pendingPipelineMessages.push({
      psid,
      senderName: 'Messenger User',
      messageText: event.postback.title,
      messageId: `postback_${event.timestamp}`,
    });
    return;
  }

  // Must have a message
  if (!event.message) {
    return;
  }

  const message = event.message;

  logger.info('Processing Messenger message', {
    psid: psid.slice(-4),
    mid: message.mid,
    hasText: !!message.text,
    hasAttachments: !!(message.attachments && message.attachments.length > 0),
    hasQuickReply: !!message.quick_reply,
  });

  // ── Handle Quick Reply button taps (suggestions + feedback) ──
  if (message.quick_reply) {
    const qrPayload = message.quick_reply.payload;

    // Feedback buttons (👍/👎) — record and acknowledge
    if (qrPayload.startsWith('fb_')) {
      await handleFeedbackQuickReply(qrPayload, psid);
      await markMessengerSeen(psid);
      return;
    }

    // Negative feedback category buttons (❌/📊/❓/🐢)
    if (qrPayload.startsWith('fbc_')) {
      await handleCategoryQuickReply(qrPayload, psid);
      await markMessengerSeen(psid);
      return;
    }

    // Suggestion buttons — treat as new user message
    if (qrPayload.startsWith('sug_')) {
      await markMessengerSeen(psid);
      sendMessengerMessage(psid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...').catch(() => {});
      pendingPipelineMessages.push({
        psid,
        senderName: 'Messenger User',
        messageText: message.text ?? qrPayload,
        messageId: message.mid,
      });
      return;
    }
  }

  // Store in CRM
  const result = await storeMessengerMessage(psid, message, 'Messenger User', 'inbound');

  if (result.messageDocId) {
    await markMessengerSeen(psid);
    logger.info('Messenger message processed', {
      docId: result.messageDocId,
      conversationId: result.conversationId,
      isNew: result.isNewConversation,
    });
  }

  // Track message for pipeline processing
  const messageText = extractMessengerMessageText(message);
  if (messageText.trim().length > 0) {
    // Send immediate "processing" acknowledgment (non-blocking)
    sendMessengerMessage(psid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...').catch(() => {});

    pendingPipelineMessages.push({
      psid,
      senderName: 'Messenger User',
      messageText,
      messageId: message.mid,
    });
  }
}

// ============================================================================
// FEEDBACK HANDLER
// ============================================================================

/**
 * Handle feedback Quick Reply taps (👍/👎).
 * Payload format: fb_{feedbackDocId}_{up|down}
 */
async function handleFeedbackQuickReply(payload: string, psid: string): Promise<void> {
  try {
    const parts = payload.split('_');
    const sentiment = parts[parts.length - 1]; // 'up' or 'down'
    const feedbackDocId = parts.slice(1, -1).join('_');

    if (!feedbackDocId || !sentiment) {
      logger.warn('Invalid feedback quick reply payload', { payload });
      return;
    }

    const isPositive = sentiment === 'up';

    // Record feedback in Firestore
    const { getFeedbackService } = await import(
      '@/services/ai-pipeline/feedback-service'
    );
    await getFeedbackService().updateRating(feedbackDocId, isPositive ? 'positive' : 'negative');

    if (isPositive) {
      await sendMessengerMessage(psid, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
    } else {
      // 👎 Negative: Send follow-up category quick replies (4 options)
      await sendMessengerQuickReplies(
        psid,
        '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;',
        [
          { content_type: 'text', title: '\u274C \u039B\u03AC\u03B8\u03BF\u03C2 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7', payload: `fbc_${feedbackDocId}_w` },
          { content_type: 'text', title: '\u{1F4CA} \u039B\u03AC\u03B8\u03BF\u03C2 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1', payload: `fbc_${feedbackDocId}_d` },
          { content_type: 'text', title: '\u2753 \u0394\u03B5\u03BD \u03BA\u03B1\u03C4\u03AC\u03BB\u03B1\u03B2\u03B5', payload: `fbc_${feedbackDocId}_u` },
          { content_type: 'text', title: '\u{1F422} \u0391\u03C1\u03B3\u03CC', payload: `fbc_${feedbackDocId}_s` },
        ],
      );
    }

    logger.info('Messenger feedback recorded', { feedbackDocId, sentiment, psid: psid.slice(-4) });
  } catch (error) {
    logger.warn('Messenger feedback handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// NEGATIVE CATEGORY HANDLER
// ============================================================================

/** Category code → Firestore value mapping */
const CATEGORY_MAP: Record<string, 'wrong_answer' | 'wrong_data' | 'not_understood' | 'slow'> = {
  w: 'wrong_answer',
  d: 'wrong_data',
  u: 'not_understood',
  s: 'slow',
};

/**
 * Handle negative feedback category quick reply taps.
 * Payload format: fbc_{feedbackDocId}_{w|d|u|s}
 */
async function handleCategoryQuickReply(payload: string, psid: string): Promise<void> {
  try {
    const parts = payload.split('_');
    const categoryCode = parts[parts.length - 1];
    const feedbackDocId = parts.slice(1, -1).join('_');

    if (!feedbackDocId || !categoryCode) {
      logger.warn('Invalid category quick reply payload', { payload });
      return;
    }

    const category = CATEGORY_MAP[categoryCode];
    if (!category) {
      logger.warn('Unknown category code', { categoryCode });
      return;
    }

    const { getFeedbackService } = await import(
      '@/services/ai-pipeline/feedback-service'
    );
    await getFeedbackService().updateNegativeCategory(feedbackDocId, category);

    await sendMessengerMessage(psid, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');

    logger.info('Messenger negative category recorded', { feedbackDocId, category });
  } catch (error) {
    logger.warn('Messenger category handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// PIPELINE FEED
// ============================================================================

/**
 * Feed a Messenger message to the AI Pipeline.
 * Uses dynamic import to avoid circular dependency issues.
 *
 * @see ADR-174 (Meta Omnichannel — Messenger)
 */
async function feedMessengerToPipeline(msg: {
  psid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}): Promise<void> {
  const companyId = process.env.DEFAULT_COMPANY_ID
    ?? process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
    ?? 'default';

  try {
    const { MessengerChannelAdapter } = await import(
      '@/services/ai-pipeline/channel-adapters/messenger-channel-adapter'
    );

    const result = await MessengerChannelAdapter.feedToPipeline({
      psid: msg.psid,
      senderName: msg.senderName,
      messageText: msg.messageText,
      messageId: msg.messageId,
      companyId,
    });

    if (result.enqueued) {
      logger.info('[Messenger->Pipeline] Enqueued', { requestId: result.requestId });
    } else {
      logger.warn('[Messenger->Pipeline] Failed', { error: result.error });
    }
  } catch (error) {
    logger.warn('[Messenger->Pipeline] Non-fatal error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header using HMAC-SHA256 with META_APP_SECRET.
 * Same shared secret as WhatsApp — all Meta Platform webhooks use the App Secret.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET?.trim();

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

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  try {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return signature === expectedSignature;
  }
}
