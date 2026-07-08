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

import type { NextRequest, NextResponse } from 'next/server';
import { storeMessengerMessage, extractMessengerMessageText } from './crm-adapter';
import { sendMessengerMessage, sendMessengerQuickReplies, markMessengerSeen } from './messenger-client';
import type {
  MessengerWebhookPayload,
  MessengerMessagingEvent,
} from './types';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import * as MetaWebhook from '@/lib/communications/meta-webhook';

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
  return MetaWebhook.handleMetaWebhookGet(request, {
    verifyToken: process.env.MESSENGER_WEBHOOK_VERIFY_TOKEN?.trim(),
    platform: 'Messenger',
    logger,
  });
}

// ============================================================================
// POST — INCOMING MESSAGES & EVENTS
// ============================================================================

/**
 * Handle incoming webhook events from Messenger Platform.
 * Signature verify + object guard + pipeline batch are owned by the shared
 * Meta webhook POST envelope (ADR-586); this file owns the Messenger payload walk.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  return MetaWebhook.handleMetaWebhookPost(request, {
    logger,
    platform: 'Messenger',
    expectedObject: 'page',
    collectPipelineMessages,
    feedToPipeline: feedMessengerToPipeline,
  });
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/** A Messenger message queued for AI pipeline processing. */
interface MessengerPipelineMessage {
  psid: string;
  senderName: string;
  messageText: string;
  messageId: string;
}

/**
 * Walk the Messenger payload, run CRM side effects, and collect the messages
 * destined for the AI pipeline (returned to the shared POST envelope).
 */
async function collectPipelineMessages(
  payload: MessengerWebhookPayload
): Promise<MessengerPipelineMessage[]> {
  const pipelineMessages: MessengerPipelineMessage[] = [];
  for (const entry of payload.entry) {
    for (const event of entry.messaging) {
      await processMessagingEvent(event, pipelineMessages);
    }
  }
  return pipelineMessages;
}

async function processMessagingEvent(
  event: MessengerMessagingEvent,
  pipelineMessages: MessengerPipelineMessage[]
): Promise<void> {
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
    pipelineMessages.push({
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
      safeFireAndForget(sendMessengerMessage(psid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...'), 'Messenger.ackMessage');
      pipelineMessages.push({
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
    safeFireAndForget(sendMessengerMessage(psid, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...'), 'Messenger.ackMessage');

    pipelineMessages.push({
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
    const parsed = MetaWebhook.parseFeedbackPayload(payload);
    if (!parsed) {
      logger.warn('Invalid feedback quick reply payload', { payload });
      return;
    }
    const { feedbackDocId, isPositive } = parsed;

    // Record feedback in Firestore (shared SSoT)
    await MetaWebhook.applyFeedbackRating(feedbackDocId, isPositive);

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

    logger.info('Messenger feedback recorded', { feedbackDocId, sentiment: isPositive ? 'up' : 'down', psid: psid.slice(-4) });
  } catch (error) {
    logger.warn('Messenger feedback handler error', {
      error: getErrorMessage(error),
    });
  }
}

// ============================================================================
// NEGATIVE CATEGORY HANDLER
// ============================================================================

/**
 * Handle negative feedback category quick reply taps.
 * Payload format: fbc_{feedbackDocId}_{w|d|u|s}
 */
async function handleCategoryQuickReply(payload: string, psid: string): Promise<void> {
  try {
    const parsed = MetaWebhook.parseCategoryPayload(payload);
    if (!parsed) {
      logger.warn('Invalid or unknown category quick reply payload', { payload });
      return;
    }
    const { feedbackDocId, category } = parsed;

    await MetaWebhook.applyNegativeCategory(feedbackDocId, category);

    await sendMessengerMessage(psid, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');

    logger.info('Messenger negative category recorded', { feedbackDocId, category });
  } catch (error) {
    logger.warn('Messenger category handler error', {
      error: getErrorMessage(error),
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
async function feedMessengerToPipeline(msg: MessengerPipelineMessage): Promise<void> {
  const companyId = getCompanyId();

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
      error: getErrorMessage(error),
    });
  }
}
