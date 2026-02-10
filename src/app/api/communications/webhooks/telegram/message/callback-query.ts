// /home/user/studio/src/app/api/communications/webhooks/telegram/message/callback-query.ts

import { createSearchMenuResponse, createContactResponse } from './responses';
import { handleEnhancedPropertySearch } from '../search/service';
import { createStatsResponse } from '../stats/service';
import type { TelegramSendPayload, TelegramCallbackQuery } from '../telegram/types';
import {
  isFeedbackCallback,
  isCategoryCallback,
  parseFeedbackCallback,
  parseCategoryCallback,
  createNegativeCategoryKeyboard,
} from '@/services/ai-pipeline/feedback-keyboard';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramCallbackQuery');

export async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<TelegramSendPayload | null> {
  const data = callbackQuery.data;

  if (!callbackQuery.message) {
    logger.warn('Callback query without message');
    return null;
  }

  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();

  logger.info('Callback query received', { data, userId });

  // Acknowledge the callback query first
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });

  switch (data) {
    case 'property_search':
    case 'new_search':
    case 'search_examples':
      return createSearchMenuResponse(chatId);

    case 'property_stats':
      return await createStatsResponse(chatId);

    case 'search_apartments':
      return await handleEnhancedPropertySearch('\u03B4\u03B9\u03B1\u03BC\u03B5\u03C1\u03AF\u03C3\u03BC\u03B1\u03C4\u03B1 \u03B4\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B1', chatId, userId);

    case 'search_maisonettes':
      return await handleEnhancedPropertySearch('\u03BC\u03B5\u03B6\u03BF\u03BD\u03AD\u03C4\u03B5\u03C2 \u03B4\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B5\u03C2', chatId, userId);

    case 'search_stores':
      return await handleEnhancedPropertySearch('\u03BA\u03B1\u03C4\u03B1\u03C3\u03C4\u03AE\u03BC\u03B1\u03C4\u03B1 \u03B4\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B1', chatId, userId);

    case 'contact_agent':
      return createContactResponse(chatId);

    default:
        // ADR-173 Phase 2: Check category callbacks BEFORE rating callbacks
        if (data && isCategoryCallback(data)) {
          return handleCategoryCallback(data, chatId);
        }

        // ADR-173: Check if this is a feedback callback (thumbs up/down)
        if (data && isFeedbackCallback(data)) {
          return handleFeedbackRatingCallback(data, chatId);
        }

        return null;
  }
}

/**
 * Handle thumbs up/down rating callback.
 * On thumbs down, sends follow-up category keyboard.
 */
async function handleFeedbackRatingCallback(
  data: string,
  chatId: number | string
): Promise<TelegramSendPayload | null> {
  const parsed = parseFeedbackCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateRating(parsed.feedbackDocId, parsed.rating);

    if (parsed.rating === 'positive') {
      return {
        chat_id: chatId,
        text: '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!',
      };
    }

    // Negative: Send follow-up category keyboard
    return {
      chat_id: chatId,
      text: '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;',
      reply_markup: createNegativeCategoryKeyboard(parsed.feedbackDocId),
    };
  } catch {
    // Non-fatal: feedback failure handled silently
    return null;
  }
}

/**
 * Handle negative feedback category selection.
 */
async function handleCategoryCallback(
  data: string,
  chatId: number | string
): Promise<TelegramSendPayload | null> {
  const parsed = parseCategoryCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateNegativeCategory(parsed.feedbackDocId, parsed.category);

    return {
      chat_id: chatId,
      text: '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.',
    };
  } catch {
    return null;
  }
}
