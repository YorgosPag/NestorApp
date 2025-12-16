// telegram-service.ts - Service for Telegram API interactions and CRM logging

import { db, isFirebaseAvailable } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';

/**
 * Sends a message to the Telegram API.
 */
export async function sendTelegramMessage(messageData: any) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const { method = 'sendMessage', ...telegramPayload } = messageData;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${method}`;

    console.log(`📤 Sending to Telegram API (${method})...`);

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload)
    });

    const result = await response.json();
    
    if (!response.ok || !result.ok) {
      console.error('❌ Telegram API Error:', result);
      return { success: false, error: result.description || 'Unknown error' };
    }

    console.log('✅ Telegram message sent successfully');
    return { success: true, result };

  } catch (error) {
    console.error('❌ Error sending Telegram message:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Stores a message record in the Firestore COLLECTIONS.COMMUNICATIONS collection.
 */
export async function storeMessageInCRM(message: any, direction: 'inbound' | 'outbound') {
  if (!isFirebaseAvailable()) {
    console.warn('⚠️ Firebase not available, skipping CRM storage');
    return null;
  }
  
  try {
    const messageRecord = {
      type: 'telegram',
      direction,
      channel: 'telegram',
      from: direction === 'inbound' ? message.from.id.toString() : 'bot',
      to: direction === 'inbound' ? 'bot' : message.chat.id.toString(),
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

    const docRef = await db.collection(COLLECTIONS.COMMUNICATIONS).add(messageRecord);
    console.log(`✅ Message stored in CRM with ID: ${docRef.id}`);
    return docRef;

  } catch (error) {
    console.error('❌ Error storing message in CRM:', error);
    return null;
  }
}
