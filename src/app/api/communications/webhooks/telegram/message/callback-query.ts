// /home/user/studio/src/app/api/communications/webhooks/telegram/message/callback-query.ts

import { createSearchMenuResponse, createContactResponse } from './responses';
import { handleEnhancedPropertySearch } from '../search/service';
import { createStatsResponse } from '../stats/service';
import type { TelegramSendPayload, TelegramCallbackQuery } from '../telegram/types';
import { isFeedbackCallback, parseFeedbackCallback } from '@/services/ai-pipeline/feedback-keyboard';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramCallbackQuery');

export async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<TelegramSendPayload | null> {
  const data = callbackQuery.data;

  // 🏢 ENTERPRISE: Safe access with undefined checks
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
      return await handleEnhancedPropertySearch('διαμερίσματα διαθέσιμα', chatId, userId);
      
    case 'search_maisonettes':
      return await handleEnhancedPropertySearch('μεζονέτες διαθέσιμες', chatId, userId);
      
    case 'search_stores':
      return await handleEnhancedPropertySearch('καταστήματα διαθέσιμα', chatId, userId);

    case 'contact_agent':
      return createContactResponse(chatId);

    default:
        // ADR-173: Check if this is a feedback callback (thumbs up/down)
        if (data && isFeedbackCallback(data)) {
          const parsed = parseFeedbackCallback(data);
          if (parsed) {
            try {
              await getFeedbackService().updateRating(parsed.feedbackDocId, parsed.rating);
              const ackText = parsed.rating === 'positive'
                ? '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!'
                : '\u{1F44E} \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE!';
              return {
                chat_id: chatId,
                text: ackText,
              };
            } catch {
              // Non-fatal: feedback failure handled silently
            }
          }
        }
        return null;
  }
}
