// /home/user/studio/src/app/api/communications/webhooks/telegram/message/process-message.ts

import { storeMessageInCRM } from '../crm/store';
import { handleEnhancedPropertySearch } from '../search/service';
import { isPropertySearchQuery } from '../search/detect';
import { createRateLimitResponse, createStartResponse, createHelpResponse, createContactResponse, createSearchMenuResponse, createDefaultResponse } from './responses';
import { checkRateLimit } from '@/lib/middleware/rate-limiter';
import { security } from './security-adapter';
import type { TelegramSendPayload, TelegramMessageObject } from '../telegram/types';
import { createStatsResponse } from '../stats/service';
import { isFirebaseAvailable } from '../firebase/availability';

export async function processMessage(message: TelegramMessageObject): Promise<TelegramSendPayload> {
  const text = message.text?.toLowerCase() || '';
  const originalText = message.text || '';
  const chatId = message.chat.id;

  // 🏢 ENTERPRISE: Safe access with undefined checks
  const userId = message.from?.id?.toString() || 'unknown';
  const userName = message.from?.first_name || 'User';

  console.log(`💬 Processing message from ${userName} (${userId}): "${originalText}"`);

  // Store inbound message if Firebase is available
  if (isFirebaseAvailable() && message.from) {
    try {
      // 🏢 ENTERPRISE: Convert to CRMStoreMessage format
      const crmMessage = {
        from: {
          id: message.from.id,
          first_name: message.from.first_name,
          username: message.from.username
        },
        chat: { id: message.chat.id },
        text: message.text,
        message_id: message.message_id
      };
      await storeMessageInCRM(crmMessage, 'inbound');
      console.log('✅ Inbound message stored in CRM');
    } catch (error) {
      console.error('⚠️ Failed to store inbound message:', error);
    }
  }

  // Rate limiting check (using centralized middleware)
  // Identifier: telegram:userId for per-user rate limiting
  const rateLimitResult = await checkRateLimit(
    `telegram:${userId}`,
    '/api/communications/webhooks/telegram'
  );
  if (!rateLimitResult.allowed) {
    // Logging handled by centralized middleware
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
