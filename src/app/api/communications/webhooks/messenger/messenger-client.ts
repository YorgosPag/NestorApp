/**
 * =============================================================================
 * FACEBOOK MESSENGER CLIENT — OUTBOUND MESSAGES
 * =============================================================================
 *
 * Sends messages via the Messenger Platform Send API (Graph API v22.0).
 * Pattern mirrors whatsapp-client.ts for consistency.
 *
 * @module api/communications/webhooks/messenger/messenger-client
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages
 */

import type {
  MessengerSendResponse,
  MessengerSendResult,
  MessengerQuickReplyButton,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessengerClient');

// ============================================================================
// CONSTANTS
// ============================================================================

const GRAPH_API_VERSION = 'v22.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================================
// SEND TEXT MESSAGE
// ============================================================================

/**
 * Send a text message to a Messenger user via PSID.
 *
 * @param recipientPsid - Page-Scoped ID of the recipient
 * @param text - Message body text
 * @returns Send result with message ID or error
 */
export async function sendMessengerMessage(
  recipientPsid: string,
  text: string
): Promise<MessengerSendResult> {
  try {
    const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      logger.error('MESSENGER_PAGE_ACCESS_TOKEN not configured');
      return { success: false, error: 'Page access token not configured' };
    }

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`;

    const payload = {
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: 'RESPONSE' as const,
    };

    logger.info('Sending Messenger message', { to: recipientPsid.slice(-4) });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as MessengerSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('Messenger API error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as MessengerSendResponse;
    logger.info('Messenger message sent', { messageId: successResult.message_id });
    return { success: true, messageId: successResult.message_id };
  } catch (error) {
    logger.error('Messenger send error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SEND QUICK REPLIES (max 13 buttons)
// ============================================================================

/**
 * Send a message with Quick Reply buttons (max 13).
 * Used for suggestions and feedback.
 *
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages/quick-replies
 */
export async function sendMessengerQuickReplies(
  recipientPsid: string,
  text: string,
  quickReplies: MessengerQuickReplyButton[]
): Promise<MessengerSendResult> {
  try {
    const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return { success: false, error: 'Page access token not configured' };
    }

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`;

    // Messenger allows max 13 quick replies, each title max 20 chars
    const safeReplies = quickReplies.slice(0, 13).map(qr => ({
      content_type: 'text' as const,
      title: qr.title.substring(0, 20),
      payload: qr.payload,
    }));

    const payload = {
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE' as const,
      message: {
        text,
        quick_replies: safeReplies,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as MessengerSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('Messenger quick reply error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as MessengerSendResponse;
    return { success: true, messageId: successResult.message_id };
  } catch (error) {
    logger.error('Messenger quick reply send error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// MARK MESSAGE AS SEEN
// ============================================================================

/**
 * Mark messages as seen (sender_action: mark_seen).
 * Sends typing indicator briefly before response.
 */
export async function markMessengerSeen(recipientPsid: string): Promise<void> {
  try {
    const accessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN?.trim();
    if (!accessToken) return;

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: 'mark_seen',
      }),
    });

    logger.info('Marked Messenger message seen', { psid: recipientPsid.slice(-4) });
  } catch (error) {
    // Non-critical — don't throw
    logger.warn('Failed to mark Messenger seen', { error });
  }
}
