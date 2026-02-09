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
  });

  switch (channel) {
    case PipelineChannel.EMAIL:
      return dispatchEmail(params);

    case PipelineChannel.TELEGRAM:
      return dispatchTelegram(params);

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
