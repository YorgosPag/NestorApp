// /home/user/studio/src/app/api/communications/webhooks/telegram/message/callback-query.ts

import { createSearchMenuResponse, createContactResponse } from './responses';
import { handleEnhancedPropertySearch } from '../search/service';
import { createStatsResponse } from '../stats/service';
import type { TelegramSendPayload, TelegramCallbackQuery } from '../telegram/types';
import {
  isFeedbackCallback,
  isCategoryCallback,
  isSuggestionCallback,
  parseFeedbackCallback,
  parseCategoryCallback,
  parseSuggestionCallback,
  createNegativeCategoryKeyboard,
} from '@/services/ai-pipeline/feedback-keyboard';
import { getFeedbackService } from '@/services/ai-pipeline/feedback-service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { COLLECTIONS } from '@/config/firestore-collections';

/** Phase 6F: Result type for suggestion callbacks that need pipeline re-feed */
export interface SuggestionCallbackResult {
  type: 'suggestion';
  suggestionText: string;
  chatId: number | string;
  userId: string;
}

const logger = createModuleLogger('TelegramCallbackQuery');

export async function handleCallbackQuery(
  callbackQuery: TelegramCallbackQuery
): Promise<TelegramSendPayload | SuggestionCallbackResult | null> {
  const data = callbackQuery.data;

  if (!callbackQuery.message) {
    logger.warn('Callback query without message');
    return null;
  }

  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();

  logger.info('Callback query received', { data, userId });

  // Acknowledge the callback query first
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });

  switch (data) {
    case 'property_search':
    case 'new_search':
    case 'search_examples':
      return createSearchMenuResponse(chatId);

    case 'property_stats':
      return await createStatsResponse(chatId);

    case 'search_apartment':
    case 'search_apartments':
      return await handleEnhancedPropertySearch('διαμερίσματα διαθέσιμα', chatId, userId);

    case 'search_studio':
      return await handleEnhancedPropertySearch('στούντιο διαθέσιμα', chatId, userId);

    case 'search_maisonette':
    case 'search_maisonettes':
      return await handleEnhancedPropertySearch('μεζονέτες διαθέσιμες', chatId, userId);

    case 'search_shop':
    case 'search_stores':
      return await handleEnhancedPropertySearch('καταστήματα διαθέσιμα', chatId, userId);

    case 'contact_agent':
      return createContactResponse(chatId);

    default:
        // Property detail callback (detail_{unitId})
        if (data && data.startsWith('detail_')) {
          return handlePropertyDetailCallback(data, chatId);
        }

        // Photos callback (photos_{unitId})
        if (data && data.startsWith('photos_')) {
          return handlePropertyPhotosCallback(data, chatId);
        }

        // 📅 Booking + admin appointment actions — delegated to booking module
        if (data) {
          const { isBookingCallback, handleBookingCallback } = await import('../booking/booking-flow');
          if (isBookingCallback(data)) {
            return handleBookingCallback(data, chatId, userId);
          }
        }

        // Back to search results (back_search_{type})
        if (data && data.startsWith('back_search_')) {
          const propertyType = data.replace('back_search_', '');
          return await handleEnhancedPropertySearch(`${propertyType} διαθέσιμα`, chatId, userId);
        }

        // Phase 6F: Check suggestion callbacks FIRST (before feedback)
        if (data && isSuggestionCallback(data)) {
          return handleSuggestionCallback(data, chatId, userId);
        }

        // ADR-173 Phase 2: Check category callbacks BEFORE rating callbacks
        if (data && isCategoryCallback(data)) {
          return handleCategoryCallback(data, chatId, callbackQuery.message.message_id);
        }

        // ADR-173: Check if this is a feedback callback (thumbs up/down)
        if (data && isFeedbackCallback(data)) {
          return handleFeedbackRatingCallback(data, chatId, callbackQuery.message.message_id);
        }

        return null;
  }
}

/**
 * Handle property detail callback — fetch unit from Firestore and display full details
 */
/**
 * Handle property photos callback — send photos from unit document
 */
async function handlePropertyPhotosCallback(
  data: string,
  chatId: number | string,
): Promise<TelegramSendPayload | null> {
  const unitId = data.replace('photos_', '');

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const doc = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();

    if (!doc.exists) return null;

    const u = doc.data() as Record<string, unknown>;
    const photos = Array.isArray(u.multiplePhotoURLs) ? u.multiplePhotoURLs as string[] : [];
    const singlePhoto = u.photoURL as string | undefined;
    const allPhotos = photos.length > 0 ? photos : (singlePhoto ? [singlePhoto] : []);

    if (allPhotos.length === 0) {
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: '📸 Δεν υπάρχουν φωτογραφίες για αυτό το ακίνητο.',
        reply_markup: {
          inline_keyboard: [
            [{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${unitId}` }],
          ],
        },
      };
    }

    // Send first photo with caption
    return {
      method: 'sendPhoto',
      chat_id: chatId,
      photo: allPhotos[0],
      caption: `📸 ${u.name ?? u.code ?? ''} (${allPhotos.length} φωτογραφίες)`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${unitId}` }],
          [{ text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' }],
        ],
      },
    };
  } catch (error) {
    logger.error('Property photos error', { unitId, error: getErrorMessage(error) });
    return null;
  }
}

async function handlePropertyDetailCallback(
  data: string,
  chatId: number | string,
): Promise<TelegramSendPayload | null> {
  const unitId = data.replace('detail_', '');

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const doc = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();

    if (!doc.exists) {
      return {
        method: 'sendMessage',
        chat_id: chatId,
        text: '❌ Το ακίνητο δεν βρέθηκε.',
      };
    }

    const u = doc.data() as Record<string, unknown>;
    const commercial = u.commercial as Record<string, unknown> | undefined;
    const areas = u.areas as Record<string, unknown> | undefined;
    const layout = u.layout as Record<string, unknown> | undefined;

    // Greek translations for property types and statuses
    const typeLabels: Record<string, string> = {
      apartment: 'Διαμέρισμα', studio: 'Στούντιο', maisonette: 'Μεζονέτα',
      shop: 'Κατάστημα', office: 'Γραφείο', storage: 'Αποθήκη',
      apartment_1br: 'Διαμέρισμα 1 υπνοδ.', penthouse: 'Ρετιρέ', loft: 'Loft',
    };
    const statusLabels: Record<string, string> = {
      available: 'Διαθέσιμο', reserved: 'Κρατημένο', sold: 'Πωλημένο', rented: 'Ενοικιασμένο',
    };

    const lines: string[] = [];
    lines.push(`🏠 <b>${u.name ?? u.code ?? unitId}</b>`);
    lines.push('');
    if (u.code) lines.push(`📍 Κωδικός: ${u.code}`);
    if (u.type) lines.push(`🏗️ Τύπος: ${typeLabels[String(u.type)] ?? u.type}`);
    if (u.floor !== undefined) lines.push(`🏢 Όροφος: ${u.floor}`);
    if (u.status) lines.push(`📊 Κατάσταση: ${statusLabels[String(u.status)] ?? u.status}`);
    lines.push('');

    // Areas
    if (areas) {
      lines.push('<b>📐 Εμβαδά:</b>');
      if (areas.gross) lines.push(`  Μικτό: ${areas.gross} τ.μ.`);
      if (areas.net) lines.push(`  Καθαρό: ${areas.net} τ.μ.`);
      if (areas.balcony) lines.push(`  Μπαλκόνι: ${areas.balcony} τ.μ.`);
      if (areas.terrace) lines.push(`  Βεράντα: ${areas.terrace} τ.μ.`);
      if (areas.garden) lines.push(`  Κήπος: ${areas.garden} τ.μ.`);
      lines.push('');
    }

    // Layout
    if (layout) {
      const parts: string[] = [];
      if (layout.bedrooms) parts.push(`${layout.bedrooms} υπνοδ.`);
      if (layout.bathrooms) parts.push(`${layout.bathrooms} μπάνια`);
      if (layout.wc) parts.push(`${layout.wc} WC`);
      if (parts.length > 0) {
        lines.push(`🛏️ Διαρρύθμιση: ${parts.join(', ')}`);
        lines.push('');
      }
    }

    // Commercial — ONLY show price to public (NO buyer name, NO reservation info)
    if (commercial) {
      if (commercial.askingPrice) {
        lines.push(`💰 <b>Τιμή: ${Number(commercial.askingPrice).toLocaleString('el-GR')} €</b>`);
      }
      // buyer/reservation info is PRIVATE — not shown to public customers
    }

    const text = lines.join('\n');

    // Build smart action buttons
    const hasPhotos = !!(u.photoURL || (Array.isArray(u.multiplePhotoURLs) && (u.multiplePhotoURLs as string[]).length > 0));
    const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    // Row 1: Photos (if available) + Appointment
    const row1: Array<{ text: string; callback_data: string }> = [];
    if (hasPhotos) {
      row1.push({ text: '📸 Φωτογραφίες', callback_data: `photos_${unitId}` });
    }
    row1.push({ text: '📅 Κλείσε ραντεβού', callback_data: `book_${unitId}` });
    keyboard.push(row1);

    // Row 2: Back to results + New search
    keyboard.push([
      { text: '↩️ Πίσω στα αποτελέσματα', callback_data: `back_search_${u.type ?? 'apartment'}` },
      { text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' },
    ]);

    // Row 3: Contact
    keyboard.push([
      { text: '📞 Επικοινωνία', callback_data: 'contact_agent' },
    ]);

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    };
  } catch (error) {
    logger.error('Property detail error', { unitId, error: getErrorMessage(error) });
    return null;
  }
}

/**
 * Handle thumbs up/down rating callback.
 * Removes feedback buttons after click (one-time use).
 * On thumbs down, sends follow-up category keyboard.
 */
async function handleFeedbackRatingCallback(
  data: string,
  chatId: number | string,
  messageId: number
): Promise<TelegramSendPayload | null> {
  const parsed = parseFeedbackCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateRating(parsed.feedbackDocId, parsed.rating);

    // Remove feedback buttons from original message (one-time use)
    if (parsed.rating === 'positive') {
      await removeFeedbackButtons(chatId, messageId, '\u{1F44D} \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE!');
      return null; // No separate message needed — edited in place
    }

    // Negative: replace feedback message, then send category keyboard
    await removeFeedbackButtons(chatId, messageId, '\u{1F44E} \u0394\u03B5\u03BD \u03AE\u03C4\u03B1\u03BD \u03C7\u03C1\u03AE\u03C3\u03B9\u03BC\u03B7.');

    // Negative: Send follow-up category keyboard
    return {
      chat_id: chatId,
      text: '\u{1F44E} \u039C\u03C0\u03BF\u03C1\u03B5\u03AF\u03C2 \u03BD\u03B1 \u03BC\u03BF\u03C5 \u03C0\u03B5\u03B9\u03C2 \u03C4\u03B9 \u03C0\u03AE\u03B3\u03B5 \u03BB\u03AC\u03B8\u03BF\u03C2;',
      reply_markup: createNegativeCategoryKeyboard(parsed.feedbackDocId),
    };
  } catch {
    // Non-fatal: feedback failure handled silently
    return null;
  }
}

/**
 * Replace feedback message with confirmation text and remove buttons.
 * Uses editMessageText to replace both text AND inline keyboard.
 */
async function removeFeedbackButtons(
  chatId: number | string,
  messageId: number,
  replacementText?: string
): Promise<void> {
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: replacementText ?? '✅ Feedback καταγράφηκε.',
          reply_markup: { inline_keyboard: [] },
        }),
      }
    );
  } catch {
    // Non-fatal: if edit fails, feedback was already recorded
  }
}

/**
 * Handle negative feedback category selection.
 */
async function handleCategoryCallback(
  data: string,
  chatId: number | string,
  messageId: number
): Promise<TelegramSendPayload | null> {
  const parsed = parseCategoryCallback(data);
  if (!parsed) return null;

  try {
    await getFeedbackService().updateNegativeCategory(parsed.feedbackDocId, parsed.category);

    // Replace category message with confirmation (one-time use)
    await removeFeedbackButtons(chatId, messageId, '\u2705 \u0395\u03C5\u03C7\u03B1\u03C1\u03B9\u03C3\u03C4\u03CE \u03B3\u03B9\u03B1 \u03C4\u03BF feedback! \u0398\u03B1 \u03B2\u03B5\u03BB\u03C4\u03B9\u03C9\u03B8\u03CE.');
    return null; // No separate message — edited in place
  } catch {
    return null;
  }
}

/**
 * Phase 6F: Handle suggested action button press.
 * Fetches the suggestion text from Firestore and returns a SuggestionCallbackResult
 * which tells the handler to re-feed this as a new message through the pipeline.
 */
async function handleSuggestionCallback(
  data: string,
  chatId: number | string,
  userId: string
): Promise<SuggestionCallbackResult | null> {
  const parsed = parseSuggestionCallback(data);
  if (!parsed) return null;

  try {
    const suggestions = await getFeedbackService().getSuggestedActions(parsed.feedbackDocId);
    const suggestionText = suggestions[parsed.index];

    if (!suggestionText) {
      logger.warn('Suggestion index out of bounds', {
        feedbackDocId: parsed.feedbackDocId,
        index: parsed.index,
        available: suggestions.length,
      });
      return null;
    }

    logger.info('Suggestion callback resolved', {
      feedbackDocId: parsed.feedbackDocId,
      index: parsed.index,
      text: suggestionText,
    });

    return {
      type: 'suggestion',
      suggestionText,
      chatId,
      userId,
    };
  } catch (error) {
    logger.warn('Failed to handle suggestion callback', {
      error: getErrorMessage(error),
    });
    return null;
  }
}
