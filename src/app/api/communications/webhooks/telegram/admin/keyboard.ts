// src/app/api/communications/webhooks/telegram/admin/keyboard.ts

import type { UserMessage, InlineKeyboardMarkup } from './types';

/**
 * Creates the inline keyboard for admin notifications.
 */
export function getAdminKeyboard(userInfo?: UserMessage): InlineKeyboardMarkup | undefined {
    if (!userInfo) return undefined;

    return {
        inline_keyboard: [
            [
                // Corrected: Use tg:// deep link to open chat with user
                { text: '💬 Άνοιγμα chat', url: `tg://user?id=${userInfo.userId}` },
                { text: '📊 Προφίλ User', callback_data: `profile_${userInfo.userId}` }
            ],
            [
                { text: '🔇 Αγνόηση', callback_data: `ignore_${userInfo.userId}` }
            ]
        ]
    };
}
