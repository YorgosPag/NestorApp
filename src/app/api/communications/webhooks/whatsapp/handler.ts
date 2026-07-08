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

import type { NextRequest, NextResponse } from 'next/server';
import { storeWhatsAppMessage, updateMessageDeliveryStatus, extractMessageText } from './crm-adapter';
import { markWhatsAppMessageRead, sendWhatsAppButtons, sendWhatsAppMessage } from './whatsapp-client';
import type {
  WhatsAppWebhookPayload,
  WhatsAppChangeValue,
  WhatsAppMessage,
  WhatsAppContact,
} from './types';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import * as MetaWebhook from '@/lib/communications/meta-webhook';

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
  return MetaWebhook.handleMetaWebhookGet(request, {
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim(),
    platform: 'WhatsApp',
    logger,
  });
}

// ============================================================================
// POST — INCOMING MESSAGES & STATUS UPDATES
// ============================================================================

/**
 * Handle incoming webhook events from WhatsApp Cloud API.
 * Signature verify + object guard + pipeline batch are owned by the shared
 * Meta webhook POST envelope (ADR-586); this file owns the WhatsApp payload walk.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  return MetaWebhook.handleMetaWebhookPost(request, {
    logger,
    platform: 'WhatsApp',
    expectedObject: 'whatsapp_business_account',
    collectPipelineMessages,
    feedToPipeline: feedWhatsAppToPipeline,
  });
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/** A WhatsApp message queued for AI pipeline processing. */
interface WhatsAppPipelineMessage {
  phoneNumber: string;
  senderName: string;
  messageText: string;
  messageId: string;
}

/**
 * Walk the WhatsApp payload, run CRM side effects, and collect the messages
 * destined for the AI pipeline (returned to the shared POST envelope).
 */
async function collectPipelineMessages(
  payload: WhatsAppWebhookPayload
): Promise<WhatsAppPipelineMessage[]> {
  const pipelineMessages: WhatsAppPipelineMessage[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        await processChangeValue(change.value, pipelineMessages);
      }
    }
  }
  return pipelineMessages;
}

async function processChangeValue(
  value: WhatsAppChangeValue,
  pipelineMessages: WhatsAppPipelineMessage[]
): Promise<void> {
  // Handle status updates (sent, delivered, read)
  if (value.statuses && value.statuses.length > 0) {
    for (const status of value.statuses) {
      await updateMessageDeliveryStatus(status.id, status.status);
    }
  }

  // Handle incoming messages
  if (value.messages && value.messages.length > 0) {
    for (const message of value.messages) {
      await processIncomingMessage(message, value.contacts, pipelineMessages);
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

async function processIncomingMessage(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[] | undefined,
  pipelineMessages: WhatsAppPipelineMessage[]
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

    // Negative feedback category buttons (❌/📊/❓/🐢)
    if (buttonId.startsWith('fbc_')) {
      await handleCategoryButton(buttonId, message.from);
      await markWhatsAppMessageRead(message.id);
      return;
    }

    // Suggestion buttons — treat as new user message, feed to pipeline
    if (buttonId.startsWith('sug_')) {
      await markWhatsAppMessageRead(message.id);
      safeFireAndForget(sendWhatsAppMessage(message.from, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...'), 'WhatsApp.ackMessage');
      pipelineMessages.push({
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
    safeFireAndForget(sendWhatsAppMessage(message.from, '\u23F3 \u0395\u03C0\u03B5\u03BE\u03B5\u03C1\u03B3\u03AC\u03B6\u03BF\u03BC\u03B1\u03B9...'), 'WhatsApp.ackMessage');

    pipelineMessages.push({
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
    const parsed = MetaWebhook.parseFeedbackPayload(buttonId);
    if (!parsed) {
      logger.warn('Invalid feedback button ID', { buttonId });
      return;
    }
    const { feedbackDocId, isPositive } = parsed;

    // Record feedback in Firestore (shared SSoT)
    await MetaWebhook.applyFeedbackRating(feedbackDocId, isPositive);

    if (isPositive) {
      await sendWhatsAppMessage(senderPhone, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
    } else {
      // 👎 Negative: Send follow-up category buttons (WhatsApp max 3 per message → 2 messages)
      await sendWhatsAppButtons(senderPhone, '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;', [
        { id: `fbc_${feedbackDocId}_w`, title: '\u274C \u039B\u03AC\u03B8\u03BF\u03C2 \u03B1\u03C0\u03AC\u03BD\u03C4\u03B7\u03C3\u03B7' },
        { id: `fbc_${feedbackDocId}_d`, title: '\u{1F4CA} \u039B\u03AC\u03B8\u03BF\u03C2 \u03B4\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03B1' },
        { id: `fbc_${feedbackDocId}_u`, title: '\u2753 \u0394\u03B5\u03BD \u03BA\u03B1\u03C4\u03AC\u03BB\u03B1\u03B2\u03B5' },
      ]);
      await sendWhatsAppButtons(senderPhone, '\u0389 \u03BA\u03AC\u03C4\u03B9 \u03AC\u03BB\u03BB\u03BF;', [
        { id: `fbc_${feedbackDocId}_s`, title: '\u{1F422} \u0391\u03C1\u03B3\u03CC' },
      ]);
    }

    logger.info('WhatsApp feedback recorded', { feedbackDocId, sentiment: isPositive ? 'up' : 'down', phone: senderPhone.slice(-4) });
  } catch (error) {
    // Non-fatal
    logger.warn('WhatsApp feedback handler error', {
      error: getErrorMessage(error),
    });
  }
}

// ============================================================================
// NEGATIVE CATEGORY HANDLER
// ============================================================================

/**
 * Handle negative feedback category button taps.
 * Button ID format: fbc_{feedbackDocId}_{w|d|u|s}
 */
async function handleCategoryButton(buttonId: string, senderPhone: string): Promise<void> {
  try {
    const parsed = MetaWebhook.parseCategoryPayload(buttonId);
    if (!parsed) {
      logger.warn('Invalid or unknown category button ID', { buttonId });
      return;
    }
    const { feedbackDocId, category } = parsed;

    await MetaWebhook.applyNegativeCategory(feedbackDocId, category);

    await sendWhatsAppMessage(senderPhone, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');

    logger.info('WhatsApp negative category recorded', { feedbackDocId, category });
  } catch (error) {
    logger.warn('WhatsApp category handler error', {
      error: getErrorMessage(error),
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
async function feedWhatsAppToPipeline(msg: WhatsAppPipelineMessage): Promise<void> {
  const companyId = getCompanyId();

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
      error: getErrorMessage(error),
    });
  }
}
