/**
 * BOOKING FLOW INTERCEPTOR — Handle booking session messages
 * Extracted from telegram-processing.ts per Google file-size standard.
 * @module api/communications/webhooks/telegram/message/booking-interceptor
 */

import type { TelegramMessage, TelegramSendPayload } from '../telegram/types';

/**
 * Handle booking flow interception (shared contact + text input).
 * Returns a TelegramSendPayload if booking consumed the message, null otherwise.
 */
export async function handleBookingFlow(
  webhookData: TelegramMessage,
  effectiveMessageText: string
): Promise<TelegramSendPayload | null> {
  const message = webhookData.message;
  if (!message) return null;

  const userId = String(message.from?.id ?? '');

  // Handle shared contact (request_contact button)
  if (message.contact && userId) {
    const { hasActiveBookingSession, handleBookingSharedContact } = await import('../booking/booking-flow');
    if (await hasActiveBookingSession(userId)) {
      const contact = message.contact;
      const response = await handleBookingSharedContact(
        userId,
        message.chat.id,
        contact.phone_number,
        contact.first_name,
        contact.last_name,
      );
      if (response) return response;
    }
  }

  // Handle text input during booking (name + phone)
  if (effectiveMessageText.trim().length > 0 && userId) {
    const { hasActiveBookingSession, handleBookingContactInput } = await import('../booking/booking-flow');
    if (await hasActiveBookingSession(userId)) {
      if (effectiveMessageText.includes('Ακύρωση')) {
        return {
          method: 'sendMessage',
          chat_id: message.chat.id,
          text: '❌ Η κράτηση ακυρώθηκε.',
          reply_markup: { remove_keyboard: true },
        };
      }

      const response = await handleBookingContactInput(
        userId,
        message.chat.id,
        effectiveMessageText,
        message.from?.first_name,
        message.from?.last_name,
      );
      if (response) return response;
    }
  }

  return null;
}
