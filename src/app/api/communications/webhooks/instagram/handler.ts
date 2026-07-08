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

import type { NextRequest, NextResponse } from 'next/server';
import { storeInstagramMessage, extractInstagramMessageText } from './crm-adapter';
import { sendInstagramMessage } from './instagram-client';
import type {
  InstagramWebhookPayload,
  InstagramMessagingEvent,
} from './types';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import * as MetaWebhook from '@/lib/communications/meta-webhook';

const logger = createModuleLogger('InstagramWebhookHandler');

// ============================================================================
// GET — WEBHOOK VERIFICATION
// ============================================================================

/**
 * Meta sends a GET request when you configure the webhook URL.
 * We must respond with the hub.challenge value if the verify token matches.
 */
export async function handleGET(request: NextRequest): Promise<NextResponse> {
  return MetaWebhook.handleMetaWebhookGet(request, {
    verifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim(),
    platform: 'Instagram',
    logger,
  });
}

// ============================================================================
// POST — INCOMING MESSAGES & EVENTS
// ============================================================================

/**
 * Handle incoming webhook events from Instagram Messaging API.
 * Signature verify + object guard + pipeline batch are owned by the shared
 * Meta webhook POST envelope (ADR-586); this file owns the Instagram payload walk.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  return MetaWebhook.handleMetaWebhookPost(request, {
    logger,
    platform: 'Instagram',
    expectedObject: 'instagram',
    collectPipelineMessages,
    feedToPipeline: feedInstagramToPipeline,
  });
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/** An Instagram message queued for AI pipeline processing. */
interface InstagramPipelineMessage {
  igsid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}

/**
 * Walk the Instagram payload, run CRM side effects, and collect the messages
 * destined for the AI pipeline (returned to the shared POST envelope).
 */
async function collectPipelineMessages(
  payload: InstagramWebhookPayload
): Promise<InstagramPipelineMessage[]> {
  const pipelineMessages: InstagramPipelineMessage[] = [];
  for (const entry of payload.entry) {
    for (const event of entry.messaging) {
      await processMessagingEvent(event, pipelineMessages);
    }
  }
  return pipelineMessages;
}

async function processMessagingEvent(
  event: InstagramMessagingEvent,
  pipelineMessages: InstagramPipelineMessage[]
): Promise<void> {
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
    safeFireAndForget(sendInstagramMessage(igsid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...'), 'Instagram.ackMessage');

    pipelineMessages.push({
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

/**
 * Look up the most recent feedback doc for an Instagram channel sender.
 * Shared by the three text-feedback branches below (avoids repeating the
 * dynamic import + lookup).
 */
async function getLatestChannelFeedback(channelSenderId: string) {
  const { getFeedbackService } = await import('@/services/ai-pipeline/feedback-service');
  return getFeedbackService().getLatestFeedbackForChannel(channelSenderId);
}

async function handleTextBasedFeedback(
  igsid: string,
  text: string
): Promise<{ handled: boolean }> {
  try {
    const channelSenderId = `instagram_${igsid}`;

    // ── 1. Check thumbs up ──
    if (POSITIVE_PATTERNS.includes(text)) {
      const latest = await getLatestChannelFeedback(channelSenderId);

      if (latest && latest.data.rating === null) {
        await MetaWebhook.applyFeedbackRating(latest.id, true);
        await sendInstagramMessage(igsid, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
        logger.info('Instagram text feedback: positive', { feedbackDocId: latest.id });
        return { handled: true };
      }
    }

    // ── 2. Check thumbs down ──
    if (NEGATIVE_PATTERNS.includes(text)) {
      const latest = await getLatestChannelFeedback(channelSenderId);

      if (latest && latest.data.rating === null) {
        await MetaWebhook.applyFeedbackRating(latest.id, false);
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
      const latest = await getLatestChannelFeedback(channelSenderId);

      if (latest && latest.data.rating === 'negative' && latest.data.negativeCategory === null) {
        await MetaWebhook.applyNegativeCategory(latest.id, category);
        await sendInstagramMessage(igsid, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');
        logger.info('Instagram text feedback: category', { feedbackDocId: latest.id, category });
        return { handled: true };
      }
    }

    return { handled: false };
  } catch (error) {
    logger.warn('Instagram text feedback handler error (non-fatal)', {
      error: getErrorMessage(error),
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
async function feedInstagramToPipeline(msg: InstagramPipelineMessage): Promise<void> {
  const companyId = getCompanyId();

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
      error: getErrorMessage(error),
    });
  }
}
