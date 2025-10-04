// /home/user/studio/src/app/api/communications/webhooks/telegram/message/process-message.ts

import { storeMessageInCRM } from '../crm/store';
import { handleEnhancedPropertySearch } from '../search/service';
import { isPropertySearchQuery } from '../search/detect';
import { createRateLimitResponse, createStartResponse, createHelpResponse, createContactResponse, createSearchMenuResponse, createDefaultResponse } from './responses';
import { checkRateLimit } from './rate-limit';
import { security } from './security-adapter';
import type { TelegramSendPayload } from '../telegram/types';
import { createStatsResponse } from '../stats/service';
import { isFirebaseAvailable } from '../firebase/availability';

export async function processMessage(message: any): Promise<TelegramSendPayload> {
  const text = message.text?.toLowerCase() || '';
  const originalText = message.text || '';
  const chatId = message.chat.id;
  const userId = message.from.id.toString();
  const userName = message.from.first_name || 'User';

  console.log(`💬 Processing message from ${userName} (${userId}): "${originalText}"`);

  // Store inbound message if Firebase is available
  if (isFirebaseAvailable()) {
    try {
      await storeMessageInCRM(message, 'inbound');
      console.log('✅ Inbound message stored in CRM');
    } catch (error) {
      console.error('⚠️ Failed to store inbound message:', error);
    }
  }

  // Rate limiting check
  if (!checkRateLimit(userId)) {
    return createRateLimitResponse(chatId);
  }

  // Bot commands
  if (text.startsWith('/start')) return createStartResponse(chatId);
  if (text.startsWith('/help')) return createHelpResponse(chatId);
  if (text.startsWith('/contact')) return createContactResponse(chatId);
  if (text.startsWith('/search') || text.startsWith('/properties')) return createSearchMenuResponse(chatId);
  if (text.startsWith('/stats') || text.startsWith('/statistics')) return await createStatsResponse(chatId);

  // Security checks
  const securityCheck = security.containsForbiddenKeywords(text);
  if (securityCheck.forbidden) {
    security.logSecurityEvent({
      type: securityCheck.type || 'unknown',
      query: text,
      reason: securityCheck.keyword || 'forbidden_keyword',
      userId: userId
    });

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: securityCheck.message,
      parse_mode: 'HTML'
    };
  }

  // Property search detection
  if (await isPropertySearchQuery(text)) {
    return await handleEnhancedPropertySearch(originalText, chatId, userId);
  }

  // Default response
  return createDefaultResponse(chatId, originalText);
}
