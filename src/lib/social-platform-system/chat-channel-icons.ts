/**
 * Το εικονίδιο κάθε **καναλιού συνομιλίας** (`social-chat-links.ts`). Ζει δίπλα στα εικονίδια πλατφορμών, γιατί
 * το Messenger δεν είναι πλατφόρμα λογαριασμού και δεν έχει γραμμή στο `UNIFIED_SOCIAL_PLATFORMS`.
 *
 * @module lib/social-platform-system/chat-channel-icons
 */

import type React from 'react';

import type { ChatChannel } from '@/lib/contact/social-chat-links';

import { InstagramIcon, MessengerIcon, TelegramIcon, ViberIcon, WhatsAppIcon } from './platform-icons';

/** ΥΠΟΧΡΕΩΤΙΚΑ κάθε κανάλι: νέο κανάλι χωρίς εικονίδιο = σφάλμα μεταγλώττισης. */
export const CHAT_CHANNEL_ICONS = {
  viber: ViberIcon,
  whatsapp: WhatsAppIcon,
  messenger: MessengerIcon,
  telegram: TelegramIcon,
  instagram: InstagramIcon,
} as const satisfies Readonly<Record<ChatChannel, React.FC<{ className?: string }>>>;
