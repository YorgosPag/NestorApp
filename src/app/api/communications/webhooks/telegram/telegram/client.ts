// /home/user/studio/src/app/api/communications/webhooks/telegram/telegram/client.ts

import type { TelegramSendPayload, TelegramSendResult } from "./types";

export async function sendTelegramMessage(payload: TelegramSendPayload): Promise<TelegramSendResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return { success: false, error: 'Bot token not configured' };
    }

    const { method = 'sendMessage', ...telegramPayload } = payload;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/${method}`;
    
    console.log(`📤 Sending to Telegram API (${method})...`);

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
