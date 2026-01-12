// /home/user/studio/src/app/api/communications/webhooks/telegram/message/callback-query.ts

import { createSearchMenuResponse, createContactResponse } from './responses';
import { handleEnhancedPropertySearch } from '../search/service';
import { createStatsResponse } from '../stats/service';
import type { TelegramSendPayload, TelegramCallbackQuery } from '../telegram/types';

export async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<TelegramSendPayload | null> {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();

  console.log(`🎯 Callback query: ${data} from user ${userId}`);
  
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
        // This is handled by the ack above, we return null to signify no further message to send
        return null;
  }
}
