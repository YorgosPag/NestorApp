/**
 * =============================================================================
 * INSTAGRAM DM CLIENT — OUTBOUND MESSAGES
 * =============================================================================
 *
 * Sends messages via the Instagram Messaging API (Graph API v22.0).
 * Pattern mirrors whatsapp-client.ts for consistency.
 *
 * Instagram DMs are text-only (no buttons, no quick replies).
 *
 * @module api/communications/webhooks/instagram/instagram-client
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 */

import type { InstagramSendResponse, InstagramSendResult } from './types';
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
