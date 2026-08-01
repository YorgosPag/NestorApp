/**
 * @fileoverview Συγχρονισμός αντίδρασης προς Telegram — fire-and-forget
 *
 * Εξήχθη από το `route.ts` (411 γρ. έναντι ορίου 300 για API route, N.7.1).
 *
 * 🏢 ENTERPRISE: Fire-and-forget pattern
 * - Does not block the main response
 * - Logs errors but doesn't fail the request
 * - Telegram reaction failures are non-critical
 */

import { sendTelegramReaction } from '@/app/api/communications/webhooks/telegram/telegram/client';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { TelegramMessageData } from './types';

const logger = createModuleLogger('MessageReactionsTelegramSync');

/**
 * Sync reaction to Telegram.
 *
 * @param messageData - Firestore message document data
 * @param emoji - The emoji to react with
 * @param remove - Whether to remove (true) or add (false) the reaction
 * @param operationId - Request tracking ID for logging
 */
export async function syncReactionToTelegram(
  messageData: TelegramMessageData,
  emoji: string,
  remove: boolean,
  operationId: string,
): Promise<void> {
  // Only sync if message is from Telegram channel
  if (messageData.channel !== 'telegram') {
    return;
  }

  // Extract Telegram-specific IDs
  const chatId = messageData.providerMetadata?.chatId;
  const providerMessageId = messageData.providerMessageId;

  if (!chatId || !providerMessageId) {
    logger.warn('[Reactions->Telegram] Missing chatId or providerMessageId for Telegram sync', {
      operationId,
      chatId,
      providerMessageId,
    });
    return;
  }

  try {
    // Convert providerMessageId to number (Telegram message_id is numeric)
    const telegramMessageId = parseInt(providerMessageId, 10);

    if (isNaN(telegramMessageId)) {
      logger.warn('[Reactions->Telegram] Invalid providerMessageId', {
        providerMessageId,
        operationId,
      });
      return;
    }

    logger.info('[Reactions->Telegram] Syncing reaction', {
      action: remove ? 'remove' : 'add',
      emoji,
      chatId,
      telegramMessageId,
      operationId,
    });

    const result = await sendTelegramReaction(chatId, telegramMessageId, emoji, remove);

    if (result.success) {
      logger.info('[Reactions->Telegram] Synced successfully', {
        emoji,
        action: remove ? 'removal' : 'addition',
        operationId,
      });
    } else {
      // Log but don't throw - Telegram sync is non-blocking
      logger.warn('[Reactions->Telegram] Sync failed', {
        error: result.error,
        operationId,
        chatId,
        telegramMessageId,
        emoji,
        remove,
      });
    }
  } catch (error) {
    // Log but don't throw - Telegram sync is non-blocking
    logger.error('[Reactions->Telegram] Unexpected error during sync', {
      operationId,
      error: getErrorMessage(error),
    });
  }
}
