// /home/user/studio/src/app/api/communications/webhooks/telegram/telegram/client.ts

import type { TelegramSendPayload, TelegramSendResult, TelegramSetReactionPayload, TelegramReactionType } from "./types";
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('TelegramClient');

/**
 * Send a photo or document to Telegram as `multipart/form-data` — required
 * when the remote URL isn't directly fetchable by Telegram's server-side
 * downloader (e.g. Firebase Storage download-token URLs, which fail with
 * `Bad Request: wrong remote file identifier specified: Wrong string length`
 * because Telegram falls back to interpreting them as `file_id`). The caller
 * downloads the binary to a `Buffer` and hands it to this helper, which wraps
 * it in `FormData` and POSTs to the appropriate Bot API method.
 *
 * Telegram limits: 10 MB per photo upload, 50 MB per document upload.
 */
export async function sendTelegramMediaMultipart(params: {
  method: 'sendPhoto' | 'sendDocument';
  chatId: number | string;
  media: Buffer;
  mediaKey: 'photo' | 'document';
  filename: string;
  contentType: string;
  caption?: string;
}): Promise<TelegramSendResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${params.method}`;

    const form = new FormData();
    form.append('chat_id', String(params.chatId));
    if (params.caption) form.append('caption', params.caption);
    const blob = new Blob([new Uint8Array(params.media)], { type: params.contentType });
    form.append(params.mediaKey, blob, params.filename);

    logger.info('Sending multipart to Telegram API', {
      method: params.method,
      bytes: params.media.byteLength,
      contentType: params.contentType,
    });

    const response = await fetch(telegramApiUrl, { method: 'POST', body: form });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      logger.error('Telegram multipart API Error', { error: result });
      return { success: false, error: result.description || 'Unknown error' };
    }

    return { success: true, result };
  } catch (error) {
    logger.error('Error sending Telegram multipart media', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function sendTelegramMessage(payload: TelegramSendPayload): Promise<TelegramSendResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const { method = 'sendMessage', ...telegramPayload } = payload;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${method}`;

    logger.info('Sending to Telegram API', { method });

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telegramPayload)
    });

    const result = await response.json();
    
    if (!response.ok || !result.ok) {
      logger.error('Telegram API Error', { error: result });
      return { success: false, error: result.description || 'Unknown error' };
    }

    logger.info('Telegram message sent successfully');
    return { success: true, result };

  } catch (error) {
    logger.error('Error sending Telegram message', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * 🏢 ENTERPRISE: Send a reaction to a Telegram message
 *
 * Uses the setMessageReaction API (Bot API 7.3+)
 * Note: Bot must be an admin in the chat to set reactions
 *
 * @param chatId - Telegram chat ID
 * @param messageId - Telegram message ID (providerMessageId)
 * @param emoji - Emoji to react with (e.g., '👍', '❤️')
 * @param remove - If true, removes the reaction instead of adding
 */
export async function sendTelegramReaction(
  chatId: string | number,
  messageId: number,
  emoji: string,
  remove: boolean = false
): Promise<TelegramSendResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setMessageReaction`;

    // Build reaction payload
    const reaction: TelegramReactionType[] = remove
      ? [] // Empty array removes reaction
      : [{ type: 'emoji', emoji }];

    const payload: Omit<TelegramSetReactionPayload, 'method'> = {
      chat_id: chatId,
      message_id: messageId,
      reaction,
      is_big: false,
    };

    logger.info('[Telegram] Setting reaction', { emoji, messageId, chatId });

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      // Common error: Bot doesn't have permission to set reactions
      if (result.error_code === 400 && result.description?.includes('REACTION_INVALID')) {
        logger.warn('[Telegram] Reaction not available for this chat');
        return { success: false, error: 'Reaction not available' };
      }
      if (result.error_code === 400 && result.description?.includes('not enough rights')) {
        logger.warn('[Telegram] Bot lacks permission to set reactions');
        return { success: false, error: 'Bot lacks permission' };
      }
      logger.error('Telegram Reaction API Error', { error: result });
      return { success: false, error: result.description || 'Unknown error' };
    }

    logger.info('[Telegram] Reaction operation completed', { action: remove ? 'removed' : 'set' });
    return { success: true, result };

  } catch (error) {
    logger.error('Error setting Telegram reaction', { error });
    return { success: false, error: getErrorMessage(error) };
  }
}
