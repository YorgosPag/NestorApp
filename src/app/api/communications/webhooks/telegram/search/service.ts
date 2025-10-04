// /home/user/studio/src/app/api/communications/webhooks/telegram/search/service.ts

import { isFirebaseAvailable } from '../firebase/availability';
import { createDatabaseUnavailableResponse, createNoResultsResponse, createTooGenericResponse, createTooManyResultsResponse, createErrorResponse } from '../message/responses';
import { security } from '../message/security-adapter';
import { searchProperties } from './repo';
import { formatSearchResultsForTelegram } from './format';
import type { TelegramSendPayload } from '../telegram/types';

export async function handleEnhancedPropertySearch(text: string, chatId: string | number, userId: string): Promise<TelegramSendPayload> {
  try {
    console.log('🔍 Processing property search:', text);

    if (!isFirebaseAvailable()) {
      return createDatabaseUnavailableResponse(chatId);
    }

    const searchResult = await searchProperties(text);

    if (!searchResult.success || searchResult.properties.length === 0) {
      return createNoResultsResponse(chatId);
    }

    console.log(`✅ Found ${searchResult.properties.length} properties`);

    // Security checks
    if (security.isTooGeneric(searchResult.criteria)) {
      return createTooGenericResponse(chatId);
    }
    if (security.exceedsResultLimit(searchResult.totalCount)) {
      return createTooManyResultsResponse(chatId);
    }

    // Format and return results
    const formattedResults = formatSearchResultsForTelegram(searchResult);

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: formattedResults,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
            { text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' }
          ]
        ]
      }
    };

  } catch (error) {
    console.error('❌ Error in property search:', error);
    return createErrorResponse(chatId);
  }
}
