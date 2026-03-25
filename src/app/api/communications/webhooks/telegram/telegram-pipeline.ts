/**
 * =============================================================================
 * TELEGRAM PIPELINE INTEGRATION — Feed messages to AI Pipeline
 * =============================================================================
 *
 * Handles feeding Telegram messages and suggestion callbacks into the
 * AI pipeline for processing. Extracted from handler.ts per ADR file-size
 * standards (max 500 lines).
 *
 * @module api/communications/webhooks/telegram/telegram-pipeline
 * @enterprise ADR-132 - UC Modules Expansion + Telegram Channel
 */

import type { TelegramMessage } from './telegram/types';
import type { MessageAttachment } from '@/types/conversations';
import { sendTelegramMessage } from './telegram/client';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('TelegramPipeline');

/**
 * Feed a Telegram message to the AI Pipeline.
 *
 * Awaitable to ensure enqueue completes before after() batch processing.
 * Non-fatal: catches all errors so pipeline failure never breaks the bot.
 * Uses dynamic import to avoid circular dependency issues.
 *
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 */
export async function feedTelegramToPipeline(
  message: TelegramMessage['message'],
  overrideText?: string,
  attachments?: MessageAttachment[]
): Promise<void> {
  if (!message) return;

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id ?? 'unknown');
  const firstName = message.from?.first_name ?? '';
  const lastName = message.from?.last_name ?? '';
  const userName = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram User';
  const messageText = overrideText ?? message.text ?? '';
  const messageId = String(message.message_id);

  // Centralized company ID (ADR-210)
  const companyId = getCompanyId();

  // RBAC: Resolve contact with project roles (cached, 0 extra reads if already resolved)
  let contactMeta: import('@/types/ai-pipeline').ContactMeta | undefined;
  try {
    const { resolveContactFromTelegram } = await import('@/services/contact-recognition/contact-linker');
    const resolved = await resolveContactFromTelegram(userId, userName);
    if (resolved) {
      contactMeta = {
        contactId: resolved.contactId,
        displayName: resolved.displayName,
        firstName: resolved.firstName,
        primaryPersona: resolved.primaryPersona,
        projectRoles: resolved.projectRoles,
        linkedUnitIds: resolved.linkedUnitIds,
      };
    }
  } catch {
    // Non-fatal
  }

  // ADR-259C: Retry once on enqueue failure + user notification
  const enqueue = async () => {
    const { TelegramChannelAdapter } = await import(
      '@/services/ai-pipeline/channel-adapters/telegram-channel-adapter'
    );
    return TelegramChannelAdapter.feedToPipeline({
      chatId,
      userId,
      userName,
      messageText,
      messageId,
      companyId,
      contactMeta,
      attachments,
    });
  };

  try {
    const result = await enqueue();
    if (result.enqueued) {
      logger.info('[Telegram->Pipeline] Enqueued', { requestId: result.requestId });
    } else {
      logger.warn('[Telegram->Pipeline] Failed', { error: result.error });
    }
  } catch (firstError) {
    logger.warn('[Telegram->Pipeline] First attempt failed, retrying once', {
      error: getErrorMessage(firstError),
    });
    try {
      const retryResult = await enqueue();
      if (retryResult.enqueued) {
        logger.info('[Telegram->Pipeline] Retry succeeded', { requestId: retryResult.requestId });
      } else {
        logger.warn('[Telegram->Pipeline] Retry returned non-enqueued', { error: retryResult.error });
      }
    } catch (retryError) {
      logger.error('[Telegram->Pipeline] Failed after retry', { error: getErrorMessage(retryError) });
      // Non-blocking: notify user that processing failed
      import('./message/responses').then(({ createPipelineRetryFailedResponse }) => {
        sendTelegramMessage(createPipelineRetryFailedResponse(Number(chatId)))
          .catch(() => { /* non-fatal */ });
      }).catch(() => { /* non-fatal */ });
    }
  }
}

/**
 * Phase 6F: Feed a suggestion action to the AI Pipeline as a new user message.
 * Reuses TelegramChannelAdapter with a synthetic message ID.
 */
export async function feedSuggestionToPipeline(
  chatId: string,
  userId: string,
  suggestionText: string
): Promise<void> {
  const companyId = getCompanyId();

  const { TelegramChannelAdapter } = await import(
    '@/services/ai-pipeline/channel-adapters/telegram-channel-adapter'
  );

  const result = await TelegramChannelAdapter.feedToPipeline({
    chatId,
    userId,
    userName: 'Admin',
    messageText: suggestionText,
    messageId: `sa_${Date.now()}`,
    companyId,
  });

  if (result.enqueued) {
    logger.info('[Suggestion->Pipeline] Enqueued', {
      requestId: result.requestId,
      text: suggestionText,
    });
  } else {
    logger.warn('[Suggestion->Pipeline] Failed', { error: result.error });
  }
}
