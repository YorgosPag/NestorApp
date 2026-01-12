// /home/user/studio/src/app/api/communications/webhooks/telegram/telegram/types.ts

/** Telegram User object from API */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/** Telegram Chat object from API */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/** Telegram Message object from API */
export interface TelegramMessageObject {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
  reply_to_message?: TelegramMessageObject;
}

/** Telegram Message Entity (for formatting) */
export interface TelegramMessageEntity {
  type: 'mention' | 'hashtag' | 'cashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'pre' | 'text_link' | 'text_mention';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

/** Telegram Callback Query object from API */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessageObject;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

/** Telegram Inline Keyboard Button */
export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
  login_url?: { url: string };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
}

/** Telegram Reply Markup */
export interface TelegramReplyMarkup {
  inline_keyboard?: TelegramInlineKeyboardButton[][];
  keyboard?: Array<Array<{ text: string; request_contact?: boolean; request_location?: boolean }>>;
  remove_keyboard?: boolean;
  force_reply?: boolean;
  selective?: boolean;
  one_time_keyboard?: boolean;
  resize_keyboard?: boolean;
}

/** Incoming Telegram webhook update */
export interface TelegramMessage {
  message?: TelegramMessageObject;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramSendPayload {
  method?: string; // default 'sendMessage'
  chat_id: number | string;
  text?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: TelegramReplyMarkup;
  callback_query_id?: string;
}

/** Telegram API response result */
export interface TelegramApiResult {
  ok: boolean;
  result?: TelegramMessageObject | boolean;
  description?: string;
  error_code?: number;
}

export interface TelegramSendResult {
  success: boolean;
  error?: string;
  result?: TelegramApiResult;
}
