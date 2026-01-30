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

// ============================================================================
// TELEGRAM MEDIA TYPES (ADR-055)
// ============================================================================

/** Telegram PhotoSize object */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/** Telegram Document object */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Audio object */
export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Video object */
export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Voice object */
export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

/** Telegram VideoNote object (circular video) */
export interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Sticker object */
export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  emoji?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Animation (GIF) object */
export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

/** Telegram Location object */
export interface TelegramLocation {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

/** Telegram Contact object */
export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

/** Telegram File object (from getFile API) */
export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
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
  // 🏢 ADR-055: Media fields
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  voice?: TelegramVoice;
  video_note?: TelegramVideoNote;
  sticker?: TelegramSticker;
  animation?: TelegramAnimation;
  location?: TelegramLocation;
  contact?: TelegramContact;
  caption?: string;
  caption_entities?: TelegramMessageEntity[];
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

// ============================================================================
// TELEGRAM REACTIONS (Bot API 7.3+)
// ============================================================================

/**
 * Telegram Reaction Type
 * @see https://core.telegram.org/bots/api#reactiontype
 */
export interface TelegramReactionTypeEmoji {
  type: 'emoji';
  emoji: string; // e.g., '👍', '❤️', '😂'
}

export interface TelegramReactionTypeCustomEmoji {
  type: 'custom_emoji';
  custom_emoji_id: string;
}

export type TelegramReactionType = TelegramReactionTypeEmoji | TelegramReactionTypeCustomEmoji;

/**
 * Telegram setMessageReaction payload
 * @see https://core.telegram.org/bots/api#setmessagereaction
 */
export interface TelegramSetReactionPayload {
  method: 'setMessageReaction';
  chat_id: number | string;
  message_id: number;
  reaction?: TelegramReactionType[];
  is_big?: boolean;
}
