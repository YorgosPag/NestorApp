// telegram-service.ts - Service for Telegram API interactions and CRM logging

import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { TelegramSendPayload, TelegramSendResult } from './telegram/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramService');

/**
 * Sends a message to the Telegram API.
 */
export async function sendTelegramMessage(messageData: TelegramSendPayload): Promise<TelegramSendResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const { method = 'sendMessage', ...telegramPayload } = messageData;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${method}`;

    logger.info('Sending to Telegram API', { method });

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload)
    });

    const result = await response.json();
    
    if (!response.ok || !result.ok) {
      logger.error('Telegram API Error', { error: result });
      return { success: false, error: result.description || 'Unknown error' };
    }

    logger.info('Telegram message sent successfully');
    return { success: true, result };

  } catch (error) {
    logger.error('Error sending Telegram message', { error });
    return { success: false, error: (error as Error).message };
  }
}

/** Message data for CRM storage */
interface CRMMessageInput {
  from?: { id: number; first_name?: string };
  chat?: { id: number };
  chat_id?: number;
  text?: string;
  message_id?: number;
}

/**
 * Stores a message record in the Firestore COLLECTIONS.MESSAGES collection.
 * @deprecated Use storeMessageInCRM from crm/store.ts instead (enterprise conversation model)
 * 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES
 */
export async function storeMessageInCRM(message: CRMMessageInput, direction: 'inbound' | 'outbound') {
  if (!isFirebaseAdminAvailable()) {
    logger.warn('Firebase not available, skipping CRM storage');
    return null;
  }

  // 🏢 ENTERPRISE: Get database instance
  const database = getAdminFirestore();
  if (!database) {
    logger.warn('Database not available');
    return null;
  }

  // 🏢 ENTERPRISE: Safe access with undefined checks
  const fromId = message.from?.id?.toString() || 'unknown';
  const chatId = message.chat?.id?.toString() || message.chat_id?.toString() || 'unknown';

  try {
    const messageRecord = {
      type: 'telegram',
      direction,
      channel: 'telegram',
      from: direction === 'inbound' ? fromId : 'bot',
      to: direction === 'inbound' ? 'bot' : chatId,
      content: message.text || '[Media Message]',
      status: direction === 'inbound' ? 'received' : 'sent',
      entityType: 'lead',
      entityId: null, // To be updated by lead matching logic
      externalId: message.message_id?.toString() || null,
      metadata: {
        userName: message.from?.first_name || 'Unknown',
        platform: 'telegram',
        chatId: message.chat?.id || message.chat_id
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES
    const docRef = await database.collection(COLLECTIONS.MESSAGES).add(messageRecord);
    logger.info('Message stored in CRM', { id: docRef.id });
    return docRef;

  } catch (error) {
    logger.error('Error storing message in CRM', { error });
    return null;
  }
}
