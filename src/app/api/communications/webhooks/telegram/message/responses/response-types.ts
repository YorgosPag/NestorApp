import type { TelegramInlineKeyboardButton } from '../../telegram/types';

export interface CompanyConfig {
  name: string;
  email: string;
  phone: string;
  hours: string;
  city: string;
  website: string;
}

export type InlineKeyboardRows = TelegramInlineKeyboardButton[][];

export interface PersonaMenuDefinition {
  greeting: string;
  buttons: InlineKeyboardRows;
}
