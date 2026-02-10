/**
 * 📊 TELEGRAM BOT STATS SERVICE
 *
 * Creates statistics responses for Telegram bot.
 * Uses centralized templates (zero hardcoded strings).
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

import { isFirebaseAvailable } from "../firebase/availability";
import { createDatabaseUnavailableResponse } from "../message/responses";
import { getPropertySummary } from "./repo";
import type { TelegramSendPayload } from "../telegram/types";
import {
  getTemplateResolver,
  formatCurrency,
  type TelegramLocale
} from '../templates/template-resolver';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TelegramStatsService');

// ============================================================================
// STATS RESPONSE
// ============================================================================

export async function createStatsResponse(
  chatId: string | number,
  locale: TelegramLocale = 'el'
): Promise<TelegramSendPayload> {
  const t = getTemplateResolver(locale);

  if (!isFirebaseAvailable()) {
    return createDatabaseUnavailableResponse(chatId, locale);
  }

  try {
    const stats = await getPropertySummary();

    // Build stats text using templates
    let statsText = `📊 <b>${t.getText('stats.title')}</b>\n\n`;
    statsText += `🏠 <b>${t.getText('stats.total', { count: stats.totalProperties })}</b>\n`;
    statsText += `✅ <b>${t.getText('stats.available', { count: stats.availableCount })}</b>\n`;
    statsText += `📋 <b>${t.getText('stats.reserved', { count: stats.reservedCount })}</b>\n`;
    statsText += `🔒 <b>${t.getText('stats.sold', { count: stats.soldCount })}</b>\n\n`;

    if (stats.averagePrice > 0) {
      statsText += `💰 <b>${t.getText('stats.averagePrice', { price: formatCurrency(Math.round(stats.averagePrice), locale) })}</b>\n\n`;
    }

    // Format date based on locale
    const dateLocale = locale === 'el' ? 'el-GR' : 'en-US';
    const lastUpdate = new Date().toLocaleString(dateLocale);
    statsText += `🕐 <i>${lastUpdate}</i>`;

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: statsText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `🔍 ${t.getText('buttons.search')}`, callback_data: 'property_search' },
            { text: `📞 ${t.getText('buttons.contact')}`, callback_data: 'contact_agent' }
          ]
        ]
      }
    };

  } catch (error) {
    logger.error('Error creating stats response', { error });
    return createDatabaseUnavailableResponse(chatId, locale);
  }
}
