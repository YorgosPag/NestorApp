/**
 * @fileoverview Telegram callback query router
 * @description Routes inline keyboard callbacks to appropriate handlers.
 */

import { createSearchMenuResponse, createContactResponse } from './responses';
import { handleEnhancedPropertySearch } from '../search/service';
import { createStatsResponse } from '../stats/service';
import type { TelegramSendPayload, TelegramCallbackQuery } from '../telegram/types';
import {
  isFeedbackCallback,
  isCategoryCallback,
  isSuggestionCallback,
} from '@/services/ai-pipeline/feedback-keyboard';
import { isDuplicateContactCallback } from '@/services/ai-pipeline/duplicate-contact-keyboard';
import { createModuleLogger } from '@/lib/telemetry';

import { handlePropertyDetailCallback, handlePropertyPhotosCallback } from './callback-property-handlers';
import {
  handleFeedbackRatingCallback,
  handleCategoryCallback,
  handleSuggestionCallback,
  handleDuplicateContactCallback,
} from './callback-action-handlers';

/** Phase 6F: Result type for suggestion callbacks that need pipeline re-feed */
export interface SuggestionCallbackResult {
  type: 'suggestion';
  suggestionText: string;
  chatId: number | string;
  userId: string;
}

const logger = createModuleLogger('TelegramCallbackQuery');

export async function handleCallbackQuery(
  callbackQuery: TelegramCallbackQuery
): Promise<TelegramSendPayload | SuggestionCallbackResult | null> {
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

    case 'search_apartment':
    case 'search_apartments':
      return await handleEnhancedPropertySearch('διαμερίσματα διαθέσιμα', chatId, userId);

    case 'search_studio':
      return await handleEnhancedPropertySearch('στούντιο διαθέσιμα', chatId, userId);

    case 'search_maisonette':
    case 'search_maisonettes':
      return await handleEnhancedPropertySearch('μεζονέτες διαθέσιμες', chatId, userId);

    case 'search_shop':
    case 'search_stores':
      return await handleEnhancedPropertySearch('καταστήματα διαθέσιμα', chatId, userId);

    case 'contact_agent':
      return createContactResponse(chatId);

    default:
        if (data && isDuplicateContactCallback(data)) {
          return handleDuplicateContactCallback(data, chatId);
        }

        if (data && data.startsWith('detail_')) {
          return handlePropertyDetailCallback(data, chatId);
        }

        if (data && data.startsWith('photos_')) {
          return handlePropertyPhotosCallback(data, chatId);
        }

        if (data) {
          const { isBookingCallback, handleBookingCallback } = await import('../booking/booking-flow');
          if (isBookingCallback(data)) {
            return handleBookingCallback(data, chatId, userId);
          }
        }

        if (data && data.startsWith('back_search_')) {
          const propertyType = data.replace('back_search_', '');
          return await handleEnhancedPropertySearch(`${propertyType} διαθέσιμα`, chatId, userId);
        }

        if (data && isSuggestionCallback(data)) {
          return handleSuggestionCallback(data, chatId, userId);
        }

        if (data && isCategoryCallback(data)) {
          return handleCategoryCallback(data, chatId, callbackQuery.message.message_id);
        }

        if (data && isFeedbackCallback(data)) {
          return handleFeedbackRatingCallback(data, chatId, callbackQuery.message.message_id);
        }

        return null;
  }
}
