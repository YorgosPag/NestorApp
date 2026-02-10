// /home/user/studio/src/app/api/communications/webhooks/telegram/search/service.ts

import { isFirebaseAvailable } from '../firebase/availability';
import { createDatabaseUnavailableResponse, createNoResultsResponse, createTooGenericResponse, createTooManyResultsResponse, createErrorResponse } from '../message/responses';
import { security } from '../message/security-adapter';
import { searchProperties } from './repo';
import { formatSearchResultsForTelegram } from './format';
import type { TelegramSendPayload } from '../telegram/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramSearchService');

export async function handleEnhancedPropertySearch(text: string, chatId: string | number, userId: string): Promise<TelegramSendPayload> {
  try {
    logger.info('Processing property search', { text });

    if (!isFirebaseAvailable()) {
      return createDatabaseUnavailableResponse(chatId);
    }

    const searchResult = await searchProperties(text);

    if (!searchResult.success || searchResult.properties.length === 0) {
      return createNoResultsResponse(chatId);
    }

    logger.info('Found properties', { count: searchResult.properties.length });

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
    logger.error('Error in property search', { error });
    return createErrorResponse(chatId);
  }
}
