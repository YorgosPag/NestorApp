/**
 * =============================================================================
 * INSTAGRAM WEBHOOK HANDLER — ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming Instagram Messaging API webhook events:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming DMs + read receipts + Quick Reply callbacks
 *
 * Security:
 * - Webhook signature verification (X-Hub-Signature-256) with META_APP_SECRET
 * - Idempotent message processing (deterministic doc IDs)
 * - Rate limiting via withWebhookRateLimit
 *
 * @module api/communications/webhooks/instagram/handler
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse, after } from 'next/server';
import { createHmac } from 'crypto';
import { storeInstagramMessage, extractInstagramMessageText } from './crm-adapter';
import { sendInstagramMessage } from './instagram-client';
import type {
  InstagramWebhookPayload,
  InstagramMessagingEvent,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('InstagramWebhookHandler');

// ============================================================================
// GET — WEBHOOK VERIFICATION
// ============================================================================

/**
 * Meta sends a GET request when you configure the webhook URL.
 * We must respond with the hub.challenge value if the verify token matches.
 */
export async function handleGET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Instagram webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('Instagram webhook verification failed', { mode, tokenMatch: token === verifyToken });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================================
// POST — INCOMING MESSAGES & EVENTS
// ============================================================================

/**
 * Handle incoming webhook events from Instagram Messaging API.
 *
 * IMPORTANT: Always return 200 to prevent Meta from retrying.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Instagram webhook signature verification failed');
      return NextResponse.json({ ok: true, rejected: true, reason: 'invalid_signature' });
    }

    // 2. Parse payload
    const payload = JSON.parse(rawBody) as InstagramWebhookPayload;

    if (payload.object !== 'instagram') {
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
        await feedInstagramToPipeline(msg);
      }

      // Trigger batch processing AFTER response is sent
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          logger.info('[Instagram->Pipeline] after(): batch complete', {
            processed: result.processed,
            failed: result.failed,
          });
        } catch (error) {
          logger.warn('[Instagram->Pipeline] after(): pipeline batch failed (cron will retry)', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Instagram webhook processing error', { error });
    return NextResponse.json({ ok: true, error: 'Processing error' });
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/** Tracks messages that need pipeline processing (for after() batch) */
const pendingPipelineMessages: Array<{
  igsid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}> = [];

async function processMessagingEvent(event: InstagramMessagingEvent): Promise<void> {
  const igsid = event.sender.id;

  // Skip read receipts
  if (event.read) {
    return;
  }

  // Must have a message
  if (!event.message) {
    return;
  }

  const message = event.message;

  logger.info('Processing Instagram message', {
    igsid: igsid.slice(-4),
    mid: message.mid,
    hasText: !!message.text,
    hasAttachments: !!(message.attachments && message.attachments.length > 0),
  });

  // ── Text-based feedback detection (Instagram doesn't support Quick Reply buttons) ──
  // Detects emoji (👍/👎) and numbered (1-4) responses as feedback.
  // Uses getLatestFeedbackForChannel() to find the most recent unrated feedback doc.
  const rawText = extractInstagramMessageText(message);
  const trimmedText = rawText.trim();

  const feedbackResult = await handleTextBasedFeedback(igsid, trimmedText);
  if (feedbackResult.handled) {
    // Feedback processed — don't feed to pipeline
    return;
  }

  // Store in CRM
  const result = await storeInstagramMessage(igsid, message, 'Instagram User', 'inbound');

  if (result.messageDocId) {
    logger.info('Instagram message processed', {
      docId: result.messageDocId,
      conversationId: result.conversationId,
      isNew: result.isNewConversation,
    });
  }

  // Track message for pipeline processing
  if (trimmedText.length > 0) {
    // Send immediate "processing" acknowledgment (non-blocking)
    sendInstagramMessage(igsid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...').catch(() => {});

    pendingPipelineMessages.push({
      igsid,
      senderName: 'Instagram User',
      messageText: trimmedText,
      messageId: message.mid,
    });
  }
}

// ============================================================================
// TEXT-BASED FEEDBACK DETECTION (Instagram doesn't support Quick Replies)
// ============================================================================

/** Thumbs up emoji variants (all skin tones) */
const POSITIVE_PATTERNS = ['\u{1F44D}', '\u{1F44D}\u{1F3FB}', '\u{1F44D}\u{1F3FC}', '\u{1F44D}\u{1F3FD}', '\u{1F44D}\u{1F3FE}', '\u{1F44D}\u{1F3FF}'];
/** Thumbs down emoji variants (all skin tones) */
const NEGATIVE_PATTERNS = ['\u{1F44E}', '\u{1F44E}\u{1F3FB}', '\u{1F44E}\u{1F3FC}', '\u{1F44E}\u{1F3FD}', '\u{1F44E}\u{1F3FE}', '\u{1F44E}\u{1F3FF}'];

/** Number text → negative feedback category mapping */
const TEXT_CATEGORY_MAP: Record<string, 'wrong_answer' | 'wrong_data' | 'not_understood' | 'slow'> = {
  '1': 'wrong_answer',
  '1\uFE0F\u20E3': 'wrong_answer',
  '2': 'wrong_data',
  '2\uFE0F\u20E3': 'wrong_data',
  '3': 'not_understood',
  '3\uFE0F\u20E3': 'not_understood',
  '4': 'slow',
  '4\uFE0F\u20E3': 'slow',
};

/**
 * Handle text-based feedback for Instagram (Quick Replies NOT supported by Instagram DM API).
 *
 * Detection priority:
 * 1. 👍 → lookup latest unrated feedback → mark as positive
 * 2. 👎 → lookup latest unrated feedback → mark as negative → send category prompt
 * 3. 1-4 (or 1️⃣-4️⃣) → lookup latest negative without category → record category
 * 4. Anything else → not handled (continue to pipeline)
 *
 * Uses getLatestFeedbackForChannel() to find the most recent feedback doc
 * within a 30-minute window for this IGSID.
 */
async function handleTextBasedFeedback(
  igsid: string,
  text: string
): Promise<{ handled: boolean }> {
  try {
    const channelSenderId = `instagram_${igsid}`;

    // ── 1. Check thumbs up ──
    if (POSITIVE_PATTERNS.includes(text)) {
      const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
      const latest = await getFeedbackService().getLatestFeedbackForChannel(channelSenderId);

      if (latest && latest.data.rating === null) {
        await getFeedbackService().updateRating(latest.id, 'positive');
        await sendInstagramMessage(igsid, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
        logger.info('Instagram text feedback: positive', { feedbackDocId: latest.id });
        return { handled: true };
      }
    }

    // ── 2. Check thumbs down ──
    if (NEGATIVE_PATTERNS.includes(text)) {
      const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
      const latest = await getFeedbackService().getLatestFeedbackForChannel(channelSenderId);

      if (latest && latest.data.rating === null) {
        await getFeedbackService().updateRating(latest.id, 'negative');
        // Send category prompt as text (4 numbered options)
        await sendInstagramMessage(
          igsid,
          '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;\n'
          + '1\uFE0F\u20E3 \u039B\u03AC\u03B8\u03BF\u03C2 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7\n'
          + '2\uFE0F\u20E3 \u039B\u03AC\u03B8\u03BF\u03C2 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1\n'
          + '3\uFE0F\u20E3 \u0394\u03B5\u03BD \u03BA\u03B1\u03C4\u03AC\u03BB\u03B1\u03B2\u03B5\n'
          + '4\uFE0F\u20E3 \u0391\u03C1\u03B3\u03CC',
        );
        logger.info('Instagram text feedback: negative', { feedbackDocId: latest.id });
        return { handled: true };
      }
    }

    // ── 3. Check category number (1-4 after negative) ──
    const category = TEXT_CATEGORY_MAP[text];
    if (category) {
      const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
      const latest = await getFeedbackService().getLatestFeedbackForChannel(channelSenderId);

      if (latest && latest.data.rating === 'negative' && latest.data.negativeCategory === null) {
        await getFeedbackService().updateNegativeCategory(latest.id, category);
        await sendInstagramMessage(igsid, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');
        logger.info('Instagram text feedback: category', { feedbackDocId: latest.id, category });
        return { handled: true };
      }
    }

    return { handled: false };
  } catch (error) {
    logger.warn('Instagram text feedback handler error (non-fatal)', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { handled: false };
  }
}

// ============================================================================
// PIPELINE FEED
// ============================================================================

/**
 * Feed an Instagram message to the AI Pipeline.
 * Uses dynamic import to avoid circular dependency issues.
 */
async function feedInstagramToPipeline(msg: {
  igsid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}): Promise<void> {
  const companyId = process.env.DEFAULT_COMPANY_ID
    ?? process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
    ?? 'default';

  try {
    const { InstagramChannelAdapter } = await import(
      '@/services/ai-pipeline/channel-adapters/instagram-channel-adapter'
    );

    const result = await InstagramChannelAdapter.feedToPipeline({
      igsid: msg.igsid,
      senderName: msg.senderName,
      messageText: msg.messageText,
      messageId: msg.messageId,
      companyId,
    });

    if (result.enqueued) {
      logger.info('[Instagram->Pipeline] Enqueued', { requestId: result.requestId });
    } else {
      logger.warn('[Instagram->Pipeline] Failed', { error: result.error });
    }
  } catch (error) {
    logger.warn('[Instagram->Pipeline] Non-fatal error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header using HMAC-SHA256 with META_APP_SECRET.
 * Same shared secret as WhatsApp/Messenger — all Meta Platform webhooks use the App Secret.
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
