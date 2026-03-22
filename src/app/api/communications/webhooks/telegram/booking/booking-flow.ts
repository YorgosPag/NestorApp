/**
 * =============================================================================
 * TELEGRAM BOOKING FLOW — Online Appointment Scheduling
 * =============================================================================
 *
 * Multi-step booking flow via Telegram inline keyboards:
 * 1. Date picker (next 7 open days)
 * 2. Time slot picker (available slots)
 * 3. Confirm + create appointment
 *
 * Uses:
 * - business-hours.ts (SSoT for schedule config)
 * - slot-generator.ts (available slots with conflict check)
 * - COLLECTIONS.APPOINTMENTS (existing Firestore schema)
 * - enterprise-id.service (ID generation)
 *
 * @module api/communications/webhooks/telegram/booking/booking-flow
 */

import type { TelegramSendPayload } from '../telegram/types';
import { getBookableDates } from '@/config/business-hours';
import { getAvailableSlots } from '@/services/appointments/slot-generator';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateEntityId } from '@/services/enterprise-id.service';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('TelegramBooking');

// ============================================================================
// CALLBACK DATA CODEC — Type-safe encoding/decoding
// ============================================================================

const SEPARATOR = '|';

interface BookingCallbackData {
  action: 'date' | 'time' | 'confirm';
  unitId: string;
  date?: string;   // YYYY-MM-DD
  time?: string;   // HH:mm
}

/** Encode booking callback data into a compact string (max 64 bytes for Telegram) */
export function encodeBookingCallback(data: BookingCallbackData): string {
  const parts = [`bk${data.action.charAt(0)}`, data.unitId.slice(-12)];
  if (data.date) parts.push(data.date);
  if (data.time) parts.push(data.time);
  return parts.join(SEPARATOR);
}

/** Decode booking callback data from string */
export function decodeBookingCallback(raw: string): BookingCallbackData | null {
  const parts = raw.split(SEPARATOR);
  if (parts.length < 2) return null;

  const actionCode = parts[0];
  const unitIdShort = parts[1];

  const actionMap: Record<string, BookingCallbackData['action']> = {
    'bkd': 'date',
    'bkt': 'time',
    'bkc': 'confirm',
  };

  const action = actionMap[actionCode];
  if (!action) return null;

  return {
    action,
    unitId: unitIdShort, // short ID — resolved via query
    date: parts[2],
    time: parts[3],
  };
}

/** Check if callback data is a booking callback */
export function isBookingCallback(data: string): boolean {
  return data.startsWith('bkd') || data.startsWith('bkt') || data.startsWith('bkc')
    || data.startsWith('book_') || data.startsWith('aa_') || data.startsWith('ar_') || data.startsWith('as_');
}

// ============================================================================
// UNIT RESOLVER
// ============================================================================

interface UnitInfo {
  id: string;
  name: string;
  code: string;
}

/** Resolve unit by full ID or short ID suffix */
async function resolveUnit(unitIdOrSuffix: string): Promise<UnitInfo | null> {
  const db = getAdminFirestore();

  // Try exact match first
  const doc = await db.collection(COLLECTIONS.UNITS).doc(unitIdOrSuffix).get();
  if (doc.exists) {
    const d = doc.data();
    return { id: doc.id, name: String(d?.name ?? ''), code: String(d?.code ?? '') };
  }

  // Try suffix match (for short IDs in callbacks)
  const snap = await db.collection(COLLECTIONS.UNITS).limit(50).get();
  const match = snap.docs.find(d => d.id.endsWith(unitIdOrSuffix));
  if (match) {
    const d = match.data();
    return { id: match.id, name: String(d?.name ?? ''), code: String(d?.code ?? '') };
  }

  return null;
}

// ============================================================================
// GREEK DATE HELPERS
// ============================================================================

const DAY_NAMES_FULL = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

function formatDateGreek(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ============================================================================
// BOOKING HANDLERS
// ============================================================================

/**
 * Handle all booking callbacks — single entry point
 */
export async function handleBookingCallback(
  data: string,
  chatId: number | string,
  userId: string,
): Promise<TelegramSendPayload | null> {
  // Legacy format: book_{unitId}
  if (data.startsWith('book_') && !data.startsWith('bookdate_') && !data.startsWith('booktime_')) {
    const unitId = data.replace('book_', '');
    return showDatePicker(unitId, chatId);
  }

  // Admin appointment actions (aa_=approve, ar_=reject, as_=reschedule)
  if (data.startsWith('aa_') || data.startsWith('ar_') || data.startsWith('as_')) {
    return handleAdminAppointmentAction(data, chatId);
  }

  // New type-safe format
  const booking = decodeBookingCallback(data);
  if (!booking) return null;

  switch (booking.action) {
    case 'date':
      return showTimePicker(booking.unitId, booking.date!, chatId);
    case 'time':
      return confirmAndSave(booking.unitId, booking.date!, booking.time!, chatId, userId);
    default:
      return null;
  }
}

/**
 * Step 1: Show date picker — next 7 open business days
 */
async function showDatePicker(
  unitId: string,
  chatId: number | string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(unitId);
  const unitName = unit?.name ?? unit?.code ?? unitId;
  const resolvedId = unit?.id ?? unitId;

  const dates = getBookableDates();

  // Build date buttons (2 per row)
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < dates.length; i += 2) {
    const row = dates.slice(i, i + 2).map(d => ({
      text: `📅 ${d.label}`,
      callback_data: encodeBookingCallback({ action: 'date', unitId: resolvedId, date: d.date }),
    }));
    keyboard.push(row);
  }
  keyboard.push([{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${resolvedId}` }]);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `📅 <b>Κλείσε ραντεβού — ${unitName}</b>\n\nΕπιλέξτε ημερομηνία:`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  };
}

/**
 * Step 2: Show available time slots for selected date
 */
async function showTimePicker(
  unitIdOrSuffix: string,
  date: string,
  chatId: number | string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(unitIdOrSuffix);
  const resolvedId = unit?.id ?? unitIdOrSuffix;

  const companyId = getCompanyId();
  const slots = await getAvailableSlots(date, companyId);
  const dateLabel = formatDateGreek(date);

  if (slots.length === 0) {
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: `😔 Δεν υπάρχουν διαθέσιμες ώρες για <b>${dateLabel}</b>.\n\nΕπιλέξτε άλλη ημέρα:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Αλλαγή ημερομηνίας', callback_data: `book_${resolvedId}` }],
          [{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${resolvedId}` }],
        ],
      },
    };
  }

  // Build time buttons (3 per row)
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < slots.length; i += 3) {
    const row = slots.slice(i, i + 3).map(time => ({
      text: `🕐 ${time}`,
      callback_data: encodeBookingCallback({ action: 'time', unitId: resolvedId, date, time }),
    }));
    keyboard.push(row);
  }
  keyboard.push([{ text: '📅 Αλλαγή ημερομηνίας', callback_data: `book_${resolvedId}` }]);
  keyboard.push([{ text: '↩️ Πίσω στο ακίνητο', callback_data: `detail_${resolvedId}` }]);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: `🕐 <b>Διαθέσιμες ώρες — ${dateLabel}</b>\n\nΕπιλέξτε ώρα:`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  };
}

/**
 * Step 3: Confirm and save appointment in Firestore
 */
async function confirmAndSave(
  unitIdOrSuffix: string,
  date: string,
  time: string,
  chatId: number | string,
  userId: string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(unitIdOrSuffix);
  const resolvedId = unit?.id ?? unitIdOrSuffix;
  const unitName = unit?.name ?? unit?.code ?? unitIdOrSuffix;

  try {
    const db = getAdminFirestore();
    const companyId = getCompanyId();
    const appointmentId = generateEntityId();
    const dateLabel = formatDateGreek(date);

    await db.collection(COLLECTIONS.APPOINTMENTS).doc(appointmentId).set({
      companyId,
      status: 'pending_approval',
      source: { channel: 'telegram', userId },
      requester: {
        name: `Telegram User ${userId}`,
        contactId: null,
        isKnownContact: false,
      },
      appointment: {
        requestedDate: date,
        requestedTime: time,
        description: `Επίσκεψη ακινήτου: ${unitName}`,
        notes: `Unit ID: ${resolvedId}`,
      },
      unitId: resolvedId,
      unitName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    logger.info('Appointment booked via Telegram', {
      appointmentId, unitId: resolvedId, date, time, userId,
    });

    // Notify admin with action buttons (fire-and-forget)
    notifyAdmin(appointmentId, unitName, dateLabel, time, userId, chatId).catch(() => { /* non-fatal */ });

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: [
        '✅ <b>Το ραντεβού σας καταχωρήθηκε!</b>',
        '',
        `🏠 Ακίνητο: <b>${unitName}</b>`,
        `📅 Ημερομηνία: <b>${dateLabel}</b>`,
        `🕐 Ώρα: <b>${time}</b>`,
        '',
        '⏳ Θα λάβετε επιβεβαίωση σύντομα.',
      ].join('\n'),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Αναζήτηση ακινήτων', callback_data: 'new_search' }],
          [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
        ],
      },
    };
  } catch (error) {
    logger.error('Booking error', { error: getErrorMessage(error) });
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: '😔 Παρουσιάστηκε σφάλμα. Δοκιμάστε ξανά ή επικοινωνήστε μαζί μας.',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Δοκιμάστε ξανά', callback_data: `book_${resolvedId}` }],
          [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
        ],
      },
    };
  }
}

// ============================================================================
// ADMIN NOTIFICATION
// ============================================================================

async function notifyAdmin(
  appointmentId: string,
  unitName: string,
  dateLabel: string,
  time: string,
  userId: string,
  customerChatId: number | string,
): Promise<void> {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '5618410820';

  const { sendTelegramMessage } = await import('../telegram/client');
  await sendTelegramMessage({
    chat_id: Number(adminChatId),
    text: [
      '📅 <b>Νέο αίτημα ραντεβού!</b>',
      '',
      `🏠 ${unitName}`,
      `📅 ${dateLabel} στις ${time}`,
      `👤 Telegram User #${userId}`,
      '',
      'Τι θέλετε να κάνετε;',
    ].join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Επιβεβαίωση', callback_data: `aa_${appointmentId.replace('ent_', '')}_${customerChatId}` },
          { text: '❌ Ακύρωση', callback_data: `ar_${appointmentId.replace('ent_', '')}_${customerChatId}` },
        ],
        [
          { text: '🔄 Πρόταση αλλαγής', callback_data: `as_${appointmentId.replace('ent_', '')}_${customerChatId}` },
        ],
      ],
    },
  });
}

// ============================================================================
// ADMIN APPOINTMENT ACTIONS (approve / reject / reschedule)
// ============================================================================

/**
 * Parse admin callback: aa_{idSuffix}_{customerChatId} (approve)
 *                       ar_{idSuffix}_{customerChatId} (reject)
 *                       as_{idSuffix}_{customerChatId} (reschedule)
 */
function parseAdminCallback(data: string): { action: string; appointmentIdSuffix: string; customerChatId: string } | null {
  const match = data.match(/^(aa|ar|as)_([^_]+)_(.+)$/);
  if (!match) return null;
  const actionMap: Record<string, string> = { aa: 'approve', ar: 'reject', as: 'reschedule' };
  return { action: actionMap[match[1]], appointmentIdSuffix: match[2], customerChatId: match[3] };
}

/**
 * Handle admin appointment action — approve, reject, or reschedule
 */
async function handleAdminAppointmentAction(
  data: string,
  adminChatId: number | string,
): Promise<TelegramSendPayload | null> {
  const parsed = parseAdminCallback(data);
  if (!parsed) return null;

  const { action, appointmentIdSuffix, customerChatId } = parsed;
  const db = getAdminFirestore();

  // Reconstruct full ID: ent_{uuid}
  const fullId = `ent_${appointmentIdSuffix}`;
  const appointmentRef = db.collection(COLLECTIONS.APPOINTMENTS).doc(fullId);
  const appointmentDoc = await appointmentRef.get();

  if (!appointmentDoc.exists) {
    return {
      method: 'sendMessage',
      chat_id: adminChatId,
      text: '❌ Το ραντεβού δεν βρέθηκε.',
    };
  }

  const apptData = appointmentDoc.data();
  const unitName = apptData?.unitName ?? 'Ακίνητο';
  const requestedDate = apptData?.appointment?.requestedDate ?? '';
  const requestedTime = apptData?.appointment?.requestedTime ?? '';
  const dateLabel = requestedDate ? formatDateGreek(requestedDate) : '';

  const { sendTelegramMessage } = await import('../telegram/client');

  switch (action) {
    case 'approve': {
      await appointmentRef.update({
        status: 'approved',
        'appointment.confirmedDate': requestedDate,
        'appointment.confirmedTime': requestedTime,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Notify customer
      await sendTelegramMessage({
        chat_id: Number(customerChatId),
        text: [
          '✅ <b>Το ραντεβού σας επιβεβαιώθηκε!</b>',
          '',
          `🏠 ${unitName}`,
          `📅 ${dateLabel} στις ${requestedTime}`,
          '',
          'Σας περιμένουμε! 😊',
        ].join('\n'),
        parse_mode: 'HTML',
      });

      return {
        method: 'sendMessage',
        chat_id: adminChatId,
        text: `✅ Ραντεβού <b>επιβεβαιώθηκε</b> — ${unitName}, ${dateLabel} ${requestedTime}.\nΟ πελάτης ειδοποιήθηκε.`,
        parse_mode: 'HTML',
      };
    }

    case 'reject': {
      await appointmentRef.update({
        status: 'rejected',
        updatedAt: new Date().toISOString(),
      });

      // Notify customer
      await sendTelegramMessage({
        chat_id: Number(customerChatId),
        text: [
          '😔 <b>Το ραντεβού σας δεν μπόρεσε να επιβεβαιωθεί.</b>',
          '',
          `🏠 ${unitName}`,
          `📅 ${dateLabel} στις ${requestedTime}`,
          '',
          'Παρακαλώ επιλέξτε νέα ημερομηνία ή επικοινωνήστε μαζί μας.',
        ].join('\n'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Νέο ραντεβού', callback_data: 'new_search' }],
            [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
          ],
        },
      });

      return {
        method: 'sendMessage',
        chat_id: adminChatId,
        text: `❌ Ραντεβού <b>ακυρώθηκε</b> — ${unitName}, ${dateLabel} ${requestedTime}.\nΟ πελάτης ειδοποιήθηκε.`,
        parse_mode: 'HTML',
      };
    }

    case 'reschedule': {
      await appointmentRef.update({
        status: 'rescheduled',
        updatedAt: new Date().toISOString(),
      });

      // Notify customer to rebook
      await sendTelegramMessage({
        chat_id: Number(customerChatId),
        text: [
          '🔄 <b>Αλλαγή ραντεβού</b>',
          '',
          `Η ώρα ${requestedTime} στις ${dateLabel} δεν είναι διαθέσιμη για το ${unitName}.`,
          '',
          'Παρακαλώ επιλέξτε νέα ημερομηνία:',
        ].join('\n'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 Επιλογή νέας ημερομηνίας', callback_data: `book_${apptData?.unitId ?? ''}` }],
            [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
          ],
        },
      });

      return {
        method: 'sendMessage',
        chat_id: adminChatId,
        text: `🔄 Ο πελάτης ειδοποιήθηκε να επιλέξει νέα ημερομηνία για ${unitName}.`,
        parse_mode: 'HTML',
      };
    }

    default:
      return null;
  }
}
