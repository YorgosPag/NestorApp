/**
 * =============================================================================
 * WHATSAPP CLOUD API CLIENT — OUTBOUND MESSAGES
 * =============================================================================
 *
 * Sends messages via the WhatsApp Cloud API (Graph API v22.0).
 * Pattern mirrors telegram/client.ts for consistency.
 *
 * @module api/communications/webhooks/whatsapp/whatsapp-client
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import type {
  WhatsAppSendTextRequest,
  WhatsAppSendResponse,
  WhatsAppSendResult,
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WhatsAppClient');

// ============================================================================
// CONSTANTS
// ============================================================================

const GRAPH_API_VERSION = 'v22.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ============================================================================
// SEND TEXT MESSAGE
// ============================================================================

/**
 * Send a text message to a WhatsApp user
 *
 * @param recipientPhone - Phone number in international format (e.g., '306912345678')
 * @param text - Message body text
 * @returns Send result with message ID or error
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  text: string
): Promise<WhatsAppSendResult> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    if (!accessToken) {
      logger.error('WHATSAPP_ACCESS_TOKEN not configured');
      return { success: false, error: 'Access token not configured' };
    }

    if (!phoneNumberId) {
      logger.error('WHATSAPP_PHONE_NUMBER_ID not configured');
      return { success: false, error: 'Phone number ID not configured' };
    }

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const payload: WhatsAppSendTextRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { body: text, preview_url: false },
    };

    logger.info('Sending WhatsApp message', { to: recipientPhone.slice(-4) });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as WhatsAppSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('WhatsApp API error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as WhatsAppSendResponse;
    const messageId = successResult.messages?.[0]?.id;

    logger.info('WhatsApp message sent', { messageId });
    return { success: true, messageId };
  } catch (error) {
    logger.error('WhatsApp send error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SEND INTERACTIVE BUTTONS (Reply Buttons — max 3)
// ============================================================================

/**
 * WhatsApp Interactive Reply Buttons — max 3 buttons per message.
 * Used for suggestions and feedback (👍/👎).
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons
 */
export async function sendWhatsAppButtons(
  recipientPhone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<WhatsAppSendResult> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    if (!accessToken || !phoneNumberId) {
      return { success: false, error: 'WhatsApp credentials not configured' };
    }

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    // WhatsApp allows max 3 buttons, each title max 20 chars
    const safeButtons = buttons.slice(0, 3).map(b => ({
      type: 'reply' as const,
      reply: {
        id: b.id,
        title: b.title.substring(0, 20),
      },
    }));

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: safeButtons },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as WhatsAppSendResponse | { error: { message: string; code: number } };

    if (!response.ok) {
      const errorResult = result as { error: { message: string; code: number } };
      logger.error('WhatsApp interactive button error', {
        status: response.status,
        error: errorResult.error?.message,
      });
      return {
        success: false,
        error: errorResult.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const successResult = result as WhatsAppSendResponse;
    return { success: true, messageId: successResult.messages?.[0]?.id };
  } catch (error) {
    logger.error('WhatsApp interactive button send error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// MARK MESSAGE AS READ
// ============================================================================

/**
 * Mark a message as read (sends blue checkmarks to the sender)
 */
export async function markWhatsAppMessageRead(messageId: string): Promise<void> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

    if (!accessToken || !phoneNumberId) return;

    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });

    logger.info('Marked message as read', { messageId });
  } catch (error) {
    // Non-critical — don't throw
    logger.warn('Failed to mark message read', { messageId, error });
  }
}
