// src/app/api/communications/webhooks/telegram/admin/client.ts

import { ADMIN_CONFIG } from './config';
import type { InlineKeyboardMarkup, TelegramResponse } from './types';

/**
 * Sends a prepared message to the Telegram API.
 */
export async function sendMessageToTelegram(
    chatId: string, 
    text: string, 
    reply_markup?: InlineKeyboardMarkup,
    parse_mode: 'HTML' | 'MarkdownV2' = 'HTML'
): Promise<TelegramResponse> {
    const { botToken } = ADMIN_CONFIG;
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode,
                reply_markup,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const json = await response.json();

        if (!json.ok) {
            console.error('Telegram API Error:', json.description);
            return { success: false, error: json.description || 'Unknown Telegram API error' };
        }

        return { success: true, result: json.result };

    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('Telegram API request timed out');
            return { success: false, error: 'Request timed out' };
        }
        console.error('Error sending message to Telegram:', error);
        return { success: false, error: error.message };
    }
}
