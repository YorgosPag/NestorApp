// /home/user/studio/src/app/api/communications/webhooks/telegram/stats/service.ts

import { isFirebaseAvailable } from "../firebase/availability";
import { createDatabaseUnavailableResponse } from "../message/responses";
import { getPropertySummary } from "./repo";
import type { TelegramSendPayload } from "../telegram/types";

export async function createStatsResponse(chatId: string | number): Promise<TelegramSendPayload> {
  if (!isFirebaseAvailable()) {
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: `📊 <b>Στατιστικά Ακινήτων</b>

⚠️ Η βάση δεδομένων δεν είναι διαθέσιμη αυτή τη στιγμή.

📞 Για ακριβή στοιχεία επικοινωνήστε μαζί μας!
- Τηλέφωνο: +30 231 012 3456
- Email: info@pagonis.gr`,
      parse_mode: 'HTML'
    };
  }

  try {
    const stats = await getPropertySummary();
    
    let statsText = `📊 <b>Στατιστικά Ακινήτων - Pagonis Real Estate</b>\n\n`;
    statsText += `🏠 <b>Συνολικά Ακίνητα:</b> ${stats.totalProperties}\n`;
    statsText += `✅ <b>Διαθέσιμα:</b> ${stats.availableCount}\n`;
    statsText += `📋 <b>Κρατημένα:</b> ${stats.reservedCount}\n`;
    statsText += `🔒 <b>Πωλημένα:</b> ${stats.soldCount}\n\n`;
    
    if (stats.averagePrice > 0) {
      statsText += `💰 <b>Μέση Τιμή:</b> €${Math.round(stats.averagePrice).toLocaleString('el-GR')}\n\n`;
    }
    
    statsText += `🕐 <b>Τελευταία ενημέρωση:</b> ${new Date().toLocaleString('el-GR')}`;

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: statsText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Αναζήτηση', callback_data: 'property_search' },
            { text: '📞 Επικοινωνία', callback_data: 'contact_agent' }
          ]
        ]
      }
    };

  } catch (error) {
    console.error('Error creating stats response:', error);
    return createDatabaseUnavailableResponse(chatId);
  }
}
