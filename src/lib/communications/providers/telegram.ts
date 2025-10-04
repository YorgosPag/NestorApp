// src/lib/communications/providers/telegram.ts

import { COMMUNICATION_CHANNELS } from '../../config/communications.config';
import type { BaseMessageInput, SendResult } from '@/types/communications';

/**
 * Telegram Bot API Provider
 * Διαχειρίζεται την αποστολή και λήψη μηνυμάτων μέσω Telegram Bot API
 */

class TelegramProvider {
  config: any;
  apiUrl: string;

  constructor() {
    this.config = (COMMUNICATION_CHANNELS as any).telegram;
    if (this.config && this.config.botToken) {
        this.apiUrl = `https://api.telegram.org/bot${this.config.botToken}`;
    } else {
        this.apiUrl = '';
    }
  }

  /**
   * Αποστολή μηνύματος μέσω Telegram
   */
  async sendMessage(messageData: BaseMessageInput & { messageId: string }): Promise<SendResult> {
    try {
      if (!this.config.enabled || !this.config.botToken) {
        throw new Error('Telegram provider is not properly configured');
      }

      const { to, content, messageType = 'text', metadata = {} } = messageData;

      let apiMethod = 'sendMessage';
      let payload: any = {
        chat_id: to,
        text: content
      };

      // Διαχείριση διαφορετικών τύπων μηνυμάτων
      switch (messageType) {
        case 'text':
          payload = {
            chat_id: to,
            text: content,
            parse_mode: metadata.parse_mode || 'HTML'
          };
          break;

        case 'photo':
          apiMethod = 'sendPhoto';
          payload = {
            chat_id: to,
            photo: metadata.photo_url || content,
            caption: metadata.caption || ''
          };
          break;
      }

      // Προσθήκη inline keyboard αν υπάρχει
      if (metadata.inline_keyboard) {
        payload.reply_markup = {
          inline_keyboard: metadata.inline_keyboard
        };
      }

      // Αποστολή αιτήματος στο Telegram API
      const response = await fetch(`${this.apiUrl}/${apiMethod}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Telegram API Error: ${result.description}`);
      }

      return {
        success: true,
        externalId: result.result.message_id.toString(),
      };

    } catch (error: any) {
      console.error('Telegram send error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parse εισερχόμενου μηνύματος από Telegram webhook
   */
  async parseIncomingMessage(webhookData: any) {
    try {
      const { message, callback_query } = webhookData;

      if (message) {
        return {
          from: message.from.id.toString(),
          to: this.config.botToken.split(':')[0], // Bot ID
          content: message.text || message.caption || '[Media Message]',
          externalId: message.message_id.toString(),
          metadata: {
            telegram_user: {
              id: message.from.id,
              username: message.from.username,
              first_name: message.from.first_name,
              last_name: message.from.last_name
            },
            chat: {
              id: message.chat.id,
              type: message.chat.type
            },
            original_message: message
          }
        };
      }

      if (callback_query) {
        return {
          from: callback_query.from.id.toString(),
          to: this.config.botToken.split(':')[0],
          content: `[Button Pressed: ${callback_query.data}]`,
          externalId: callback_query.id,
          metadata: {
            telegram_user: {
              id: callback_query.from.id,
              username: callback_query.from.username,
              first_name: callback_query.from.first_name,
              last_name: callback_query.from.last_name
            },
            callback_data: callback_query.data,
            original_callback: callback_query
          }
        };
      }

      throw new Error('Unrecognized Telegram webhook format');
    } catch (error) {
      console.error('Error parsing Telegram message:', error);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`);
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.description);
      }
      return {
        success: true,
        message: `Connected to Telegram Bot: ${result.result.first_name} (@${result.result.username})`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default TelegramProvider;
