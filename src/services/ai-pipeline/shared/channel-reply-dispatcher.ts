/**
 * =============================================================================
 * 🏢 ENTERPRISE: CHANNEL REPLY DISPATCHER
 * =============================================================================
 *
 * Centralized dispatcher that routes outbound replies to the appropriate
 * channel (Email via Mailgun, Telegram, etc.).
 *
 * Eliminates channel-specific coupling in UC modules — modules call
 * sendChannelReply() and the dispatcher handles the rest.
 *
 * @module services/ai-pipeline/shared/channel-reply-dispatcher
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { PipelineChannel } from '@/types/ai-pipeline';
import type { PipelineChannelValue } from '@/types/ai-pipeline';
import { sendReplyViaMailgun } from './mailgun-sender';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('CHANNEL_REPLY_DISPATCHER');

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for sending a reply via any channel */
export interface ChannelReplyParams {
  /** The channel to send the reply through */
  channel: PipelineChannelValue;
  /** Recipient email address (required for email channel) */
  recipientEmail?: string;
  /** Telegram chat ID (required for telegram channel) */
  telegramChatId?: string;
  /** WhatsApp phone number (required for whatsapp channel) */
  whatsappPhone?: string;
  /** Messenger PSID (required for messenger channel) */
  messengerPsid?: string;
  /** Instagram IGSID (required for instagram channel) */
  instagramIgsid?: string;
  /** In-app voice command document ID (required for in_app channel) */
  inAppCommandId?: string;
  /** Email subject (email only) */
  subject?: string;
  /** Reply text body */
  textBody: string;
  /** Pipeline request ID for correlation */
  requestId: string;
}

/** Result of sending a channel reply */
export interface ChannelReplyResult {
  /** Whether the reply was sent successfully */
  success: boolean;
  /** Provider-specific message ID */
  messageId?: string;
  /** Error message if failed */
  error?: string;
  /** Channel used for sending */
  channel: PipelineChannelValue;
}

// ============================================================================
// DISPATCHER
// ============================================================================

/**
 * Send a reply through the appropriate channel.
 *
 * Routes to:
 * - `email` → sendReplyViaMailgun()
 * - `telegram` → sendTelegramMessage() (dynamic import)
 * - Other → error (unsupported_channel)
 *
 * @param params Channel-agnostic reply parameters
 * @returns Result with success status and optional messageId
 */
export async function sendChannelReply(
  params: ChannelReplyParams
): Promise<ChannelReplyResult> {
  const { channel, requestId } = params;

  logger.info('Dispatching reply', {
    requestId,
    channel,
    hasEmail: !!params.recipientEmail,
    hasTelegramChat: !!params.telegramChatId,
    hasInAppCommand: !!params.inAppCommandId,
    hasWhatsAppPhone: !!params.whatsappPhone,
    hasMessengerPsid: !!params.messengerPsid,
    hasInstagramIgsid: !!params.instagramIgsid,
  });

  switch (channel) {
    case PipelineChannel.EMAIL:
      return dispatchEmail(params);

    case PipelineChannel.TELEGRAM:
      return dispatchTelegram(params);

    case PipelineChannel.WHATSAPP:
      return dispatchWhatsApp(params);

    case PipelineChannel.MESSENGER:
      return dispatchMessenger(params);

    case PipelineChannel.INSTAGRAM:
      return dispatchInstagram(params);

    case PipelineChannel.IN_APP:
      return dispatchInApp(params);

    default:
      logger.warn('Unsupported channel for reply dispatch', {
        requestId,
        channel,
      });
      return {
        success: false,
        error: `Unsupported reply channel: ${channel}`,
        channel,
      };
  }
}

// ============================================================================
// CHANNEL-SPECIFIC DISPATCHERS
// ============================================================================

/**
 * Dispatch reply via Mailgun email
 */
async function dispatchEmail(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { recipientEmail, subject, textBody, requestId } = params;

  if (!recipientEmail) {
    logger.warn('Email dispatch: no recipient email', { requestId });
    return {
      success: false,
      error: 'No recipient email for email channel',
      channel: PipelineChannel.EMAIL,
    };
  }

  const result = await sendReplyViaMailgun({
    to: recipientEmail,
    subject: subject ?? 'Απάντηση',
    textBody,
  });

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    channel: PipelineChannel.EMAIL,
  };
}

/**
 * Dispatch reply via Telegram Bot API
 * Uses dynamic import to avoid build issues with telegram client
 */
async function dispatchTelegram(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { telegramChatId, textBody, requestId } = params;

  if (!telegramChatId) {
    logger.warn('Telegram dispatch: no chat ID', { requestId });
    return {
      success: false,
      error: 'No Telegram chat ID for telegram channel',
      channel: PipelineChannel.TELEGRAM,
    };
  }

  try {
    // Dynamic import to avoid circular dependencies and build issues
    const { sendTelegramMessage } = await import(
      '@/app/api/communications/webhooks/telegram/telegram/client'
    );

    const result = await sendTelegramMessage({
      chat_id: Number(telegramChatId),
      text: textBody,
    });

    if (result.success) {
      logger.info('Telegram reply sent', {
        requestId,
        chatId: telegramChatId,
      });
      return {
        success: true,
        messageId: String(telegramChatId),
        channel: PipelineChannel.TELEGRAM,
      };
    }

    logger.warn('Telegram reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Telegram send failed',
      channel: PipelineChannel.TELEGRAM,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Telegram dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Telegram dispatch error: ${errorMessage}`,
      channel: PipelineChannel.TELEGRAM,
    };
  }
}

/**
 * Dispatch reply via WhatsApp Cloud API
 * Uses dynamic import to avoid build issues with WhatsApp client
 *
 * @see ADR-174 (Meta Omnichannel — WhatsApp)
 */
async function dispatchWhatsApp(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { whatsappPhone, textBody, requestId } = params;

  if (!whatsappPhone) {
    logger.warn('WhatsApp dispatch: no phone number', { requestId });
    return {
      success: false,
      error: 'No WhatsApp phone number for whatsapp channel',
      channel: PipelineChannel.WHATSAPP,
    };
  }

  try {
    // Dynamic import to avoid circular dependencies and build issues
    const { sendWhatsAppMessage } = await import(
      '@/app/api/communications/webhooks/whatsapp/whatsapp-client'
    );

    const result = await sendWhatsAppMessage(whatsappPhone, textBody);

    if (result.success) {
      logger.info('WhatsApp reply sent', {
        requestId,
        phone: whatsappPhone.slice(-4), // Privacy: last 4 digits only
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.WHATSAPP,
      };
    }

    logger.warn('WhatsApp reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'WhatsApp send failed',
      channel: PipelineChannel.WHATSAPP,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('WhatsApp dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `WhatsApp dispatch error: ${errorMessage}`,
      channel: PipelineChannel.WHATSAPP,
    };
  }
}

/**
 * Dispatch reply via Facebook Messenger Send API
 * Uses dynamic import to avoid build issues with Messenger client
 *
 * @see ADR-174 (Meta Omnichannel — Messenger)
 */
async function dispatchMessenger(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { messengerPsid, textBody, requestId } = params;

  if (!messengerPsid) {
    logger.warn('Messenger dispatch: no PSID', { requestId });
    return {
      success: false,
      error: 'No Messenger PSID for messenger channel',
      channel: PipelineChannel.MESSENGER,
    };
  }

  try {
    const { sendMessengerMessage } = await import(
      '@/app/api/communications/webhooks/messenger/messenger-client'
    );

    const result = await sendMessengerMessage(messengerPsid, textBody);

    if (result.success) {
      logger.info('Messenger reply sent', {
        requestId,
        psid: messengerPsid.slice(-4),
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.MESSENGER,
      };
    }

    logger.warn('Messenger reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Messenger send failed',
      channel: PipelineChannel.MESSENGER,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Messenger dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Messenger dispatch error: ${errorMessage}`,
      channel: PipelineChannel.MESSENGER,
    };
  }
}

/**
 * Dispatch reply via Instagram Messaging API
 * Uses dynamic import to avoid build issues with Instagram client
 *
 * @see ADR-174 (Meta Omnichannel — Instagram)
 */
async function dispatchInstagram(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { instagramIgsid, textBody, requestId } = params;

  if (!instagramIgsid) {
    logger.warn('Instagram dispatch: no IGSID', { requestId });
    return {
      success: false,
      error: 'No Instagram IGSID for instagram channel',
      channel: PipelineChannel.INSTAGRAM,
    };
  }

  try {
    const { sendInstagramMessage } = await import(
      '@/app/api/communications/webhooks/instagram/instagram-client'
    );

    const result = await sendInstagramMessage(instagramIgsid, textBody);

    if (result.success) {
      logger.info('Instagram reply sent', {
        requestId,
        igsid: instagramIgsid.slice(-4),
      });
      return {
        success: true,
        messageId: result.messageId ?? undefined,
        channel: PipelineChannel.INSTAGRAM,
      };
    }

    logger.warn('Instagram reply failed', {
      requestId,
      error: result.error,
    });
    return {
      success: false,
      error: result.error ?? 'Instagram send failed',
      channel: PipelineChannel.INSTAGRAM,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Instagram dispatch error', {
      requestId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `Instagram dispatch error: ${errorMessage}`,
      channel: PipelineChannel.INSTAGRAM,
    };
  }
}

/**
 * Dispatch reply via In-App voice command update (ADR-164)
 * Updates the voice_commands Firestore document with the AI response.
 */
async function dispatchInApp(params: ChannelReplyParams): Promise<ChannelReplyResult> {
  const { inAppCommandId, textBody, requestId } = params;

  if (!inAppCommandId) {
    logger.warn('In-app dispatch: no command ID', { requestId });
    return {
      success: false,
      error: 'No in-app command ID for in_app channel',
      channel: PipelineChannel.IN_APP,
    };
  }

  try {
    const adminDb = getAdminFirestore();
    await adminDb
      .collection(COLLECTIONS.VOICE_COMMANDS)
      .doc(inAppCommandId)
      .update({
        status: 'completed',
        aiResponse: textBody,
        completedAt: new Date().toISOString(),
      });

    logger.info('In-app reply dispatched', {
      requestId,
      commandId: inAppCommandId,
    });

    return {
      success: true,
      messageId: inAppCommandId,
      channel: PipelineChannel.IN_APP,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('In-app dispatch error', {
      requestId,
      commandId: inAppCommandId,
      error: errorMessage,
    });
    return {
      success: false,
      error: `In-app dispatch error: ${errorMessage}`,
      channel: PipelineChannel.IN_APP,
    };
  }
}
