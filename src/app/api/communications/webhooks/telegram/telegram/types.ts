// /home/user/studio/src/app/api/communications/webhooks/telegram/telegram/types.ts

export interface TelegramMessage {
  message?: any;
  callback_query?: any;
}

export interface TelegramSendPayload {
  method?: string; // default 'sendMessage'
  chat_id: number | string;
  text?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: any;
  callback_query_id?: string;
}

export interface TelegramSendResult {
  success: boolean;
  error?: string;
  result?: any;
}
