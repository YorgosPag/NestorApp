// src/app/api/communications/webhooks/telegram/admin/config.ts

interface AdminConfig {
    botToken: string;
    adminChatId: string;
    enabled: boolean;
}

export const ADMIN_CONFIG: AdminConfig = {
    botToken: process.env.ADMIN_TELEGRAM_BOT_TOKEN ?? '',
    adminChatId: process.env.ADMIN_TELEGRAM_CHAT_ID ?? '',
    enabled: (process.env.ADMIN_NOTIFICATIONS_ENABLED ?? 'false').toLowerCase() === 'true',
};

export function isConfigured(): boolean {
    return ADMIN_CONFIG.enabled && !!ADMIN_CONFIG.botToken && !!ADMIN_CONFIG.adminChatId;
}
