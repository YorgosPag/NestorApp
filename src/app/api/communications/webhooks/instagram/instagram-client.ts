/**
 * =============================================================================
 * INSTAGRAM DM CLIENT — OUTBOUND MESSAGES
 * =============================================================================
 *
 * Sends messages via the Instagram Messaging API (Graph API v22.0).
 * Pattern mirrors messenger-client.ts for consistency.
 *
 * Supports:
 * - Text messages
 * - Quick Replies (up to 13 buttons, 20 chars each) — same format as Messenger
 *
 * @module api/communications/webhooks/instagram/instagram-client
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 */

import type { InstagramSendResponse, InstagramSendResult, InstagramQuickReplyButton } from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('InstagramClient');

// ============================================================================
// CONSTANTS
// ============================================================================

const GRAPH_API_VERSION = 'v22.0';
const GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// ============================================================================
// SEND TEXT MESSAGE
// ============================================================================

/**
 * Send a text message to an Instagram user via IGSID.
 *
 * @param recipientIgsid - Instagram-Scoped ID of the recipient
 * @param text - Message body text
 * @returns Send result with message ID or error
 */
export async function sendInstagramMessage(
  recipientIgsid: string,
  text: string
): Promise<InstagramSendResult> {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      logger.error('INSTAGRAM_ACCESS_TOKEN not configured');
      return { success: false, error: 'Instagram access token not configured' };
    }

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`;

    const payload = {
      recipient: { id: recipientIgsid },
      message: { text },
    };

    logger.info('Sending Instagram message', { to: recipientIgsid.slice(-4) });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as InstagramSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('Instagram API error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as InstagramSendResponse;
    logger.info('Instagram message sent', { messageId: successResult.message_id });
    return { success: true, messageId: successResult.message_id };
  } catch (error) {
    logger.error('Instagram send error', { error });
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
 * Used for suggestions and feedback (👍/👎).
 *
 * Instagram Quick Replies use the same format as Messenger:
 * content_type: 'text', title (max 20 chars), payload.
 *
 * @see https://developers.facebook.com/docs/instagram-messaging/guides/quick-replies
 */
export async function sendInstagramQuickReplies(
  recipientIgsid: string,
  text: string,
  quickReplies: InstagramQuickReplyButton[]
): Promise<InstagramSendResult> {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();

    if (!accessToken) {
      return { success: false, error: 'Instagram access token not configured' };
    }

    const url = `${GRAPH_API_BASE}/me/messages?access_token=${accessToken}`;

    // Instagram allows max 13 quick replies, each title max 20 chars
    const safeReplies = quickReplies.slice(0, 13).map(qr => ({
      content_type: 'text' as const,
      title: qr.title.substring(0, 20),
      payload: qr.payload,
    }));

    const payload = {
      recipient: { id: recipientIgsid },
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

    const result = await response.json() as InstagramSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('Instagram quick reply error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as InstagramSendResponse;
    return { success: true, messageId: successResult.message_id };
  } catch (error) {
    logger.error('Instagram quick reply send error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
