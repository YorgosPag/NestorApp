// src/app/api/communications/webhooks/telegram/admin/types.ts

export type QueryType = 'property_search' | 'contact' | 'general' | 'security_alert';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'new_message' | 'security_alert' | 'system_event';

export interface UserMessage {
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    messageText: string;
    timestamp: string;
    queryType: QueryType;
    searchCriteria?: Record<string, string | number | boolean>;
    securityIssue?: string;
}
  
export interface AdminNotification {
    type: NotificationType;
    priority: Priority;
    message: string;
    userInfo?: UserMessage;
    timestamp: string;
}

export interface InlineKeyboardButton {
    text: string;
    url?: string;
    callback_data?: string;
}

export interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][];
}

/** Telegram API message result */
export interface TelegramMessageResult {
    message_id: number;
    chat: { id: number; type: string };
    date: number;
    text?: string;
}

export interface TelegramResponse {
    success: boolean;
    result?: TelegramMessageResult | boolean;
    error?: string;
}
