/**
 * @fileoverview Property callback handlers for Telegram bot
 * @description Handles property detail and photos callbacks.
 */

import type { TelegramSendPayload } from '../telegram/types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('TelegramCallbackProperty');

// ============================================================================
// PROPERTY PHOTOS
// ============================================================================

export async function handlePropertyPhotosCallback(
  data: string,
  chatId: number | string,
): Promise<TelegramSendPayload | null> {
  const propertyId = data.replace('photos_', '');

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const doc = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();

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
            [{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${propertyId}` }],
          ],
        },
      };
    }

    return {
      method: 'sendPhoto',
      chat_id: chatId,
      photo: allPhotos[0],
      caption: `📸 ${u.name ?? u.code ?? ''} (${allPhotos.length} φωτογραφίες)`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${propertyId}` }],
          [{ text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' }],
        ],
      },
    };
  } catch (error) {
    logger.error('Property photos error', { propertyId, error: getErrorMessage(error) });
    return null;
  }
}

// ============================================================================
// PROPERTY DETAIL
// ============================================================================

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Διαμέρισμα', studio: 'Στούντιο', maisonette: 'Μεζονέτα',
  shop: 'Κατάστημα', office: 'Γραφείο', storage: 'Αποθήκη',
  apartment_1br: 'Διαμέρισμα 1 υπνοδ.', penthouse: 'Ρετιρέ', loft: 'Loft',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Διαθέσιμο', reserved: 'Κρατημένο', sold: 'Πωλημένο', rented: 'Ενοικιασμένο',
};

export async function handlePropertyDetailCallback(
  data: string,
  chatId: number | string,
): Promise<TelegramSendPayload | null> {
  const propertyId = data.replace('detail_', '');

  try {
    const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
    const db = getAdminFirestore();
    const doc = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();

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

    const lines: string[] = [];
    lines.push(`🏠 <b>${u.name ?? u.code ?? propertyId}</b>`);
    lines.push('');
    if (u.code) lines.push(`📍 Κωδικός: ${u.code}`);
    if (u.type) lines.push(`🏗️ Τύπος: ${TYPE_LABELS[String(u.type)] ?? u.type}`);
    if (u.floor !== undefined) lines.push(`🏢 Όροφος: ${u.floor}`);
    if (u.status) lines.push(`📊 Κατάσταση: ${STATUS_LABELS[String(u.status)] ?? u.status}`);
    lines.push('');

    if (areas) {
      lines.push('<b>📐 Εμβαδά:</b>');
      if (areas.gross) lines.push(`  Μικτό: ${areas.gross} τ.μ.`);
      if (areas.net) lines.push(`  Καθαρό: ${areas.net} τ.μ.`);
      if (areas.balcony) lines.push(`  Μπαλκόνι: ${areas.balcony} τ.μ.`);
      if (areas.terrace) lines.push(`  Βεράντα: ${areas.terrace} τ.μ.`);
      if (areas.garden) lines.push(`  Κήπος: ${areas.garden} τ.μ.`);
      lines.push('');
    }

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

    if (commercial?.askingPrice) {
      lines.push(`💰 <b>Τιμή: ${Number(commercial.askingPrice).toLocaleString('el-GR')} €</b>`);
    }

    const text = lines.join('\n');

    const hasPhotos = !!(u.photoURL || (Array.isArray(u.multiplePhotoURLs) && (u.multiplePhotoURLs as string[]).length > 0));
    const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

    const row1: Array<{ text: string; callback_data: string }> = [];
    if (hasPhotos) {
      row1.push({ text: '📸 Φωτογραφίες', callback_data: `photos_${propertyId}` });
    }
    row1.push({ text: '📅 Κλείσε ραντεβού', callback_data: `book_${propertyId}` });
    keyboard.push(row1);

    keyboard.push([
      { text: '↩️ Πίσω στα αποτελέσματα', callback_data: `back_search_${u.type ?? 'apartment'}` },
      { text: '🔍 Νέα Αναζήτηση', callback_data: 'new_search' },
    ]);

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
    logger.error('Property detail error', { propertyId, error: getErrorMessage(error) });
    return null;
  }
}
