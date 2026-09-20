/**
 * =============================================================================
 * BOOKING HANDLERS — Date/Time/Confirm steps + Save Appointment
 * =============================================================================
 *
 * @module api/communications/webhooks/telegram/booking/booking-handlers
 */

import type { TelegramSendPayload } from '../telegram/types';
import { getBookableDates } from '@/config/business-hours';
import { getAvailableSlots } from '@/services/appointments/slot-generator';
import { withAppointmentSchedule } from '@/services/appointments/appointment-schedule';
// ADR-869 §13 — ο ΕΝΑΣ μεταφραστής του bot (ήδη σε χρήση από `search/` και `templates/`).
import { TelegramTemplateResolver } from '../templates/template-resolver';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateEntityId } from '@/services/enterprise-id.service';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import {
  encodeBookingCallback,
  decodeBookingCallback,
  resolveUnit,
  formatDateGreek,
} from './booking-codec';
import { saveSession } from './booking-session';
import { handleAdminAppointmentAction } from './booking-admin-actions';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TelegramBookingHandlers');
const templates = new TelegramTemplateResolver();

// =============================================================================
// MAIN CALLBACK ROUTER
// =============================================================================

export async function handleBookingCallback(
  data: string,
  chatId: number | string,
  userId: string,
): Promise<TelegramSendPayload | null> {
  // Legacy format: book_{propertyId}
  if (data.startsWith('book_') && !data.startsWith('bookdate_') && !data.startsWith('booktime_')) {
    const propertyId = data.replace('book_', '');
    return showDatePicker(propertyId, chatId);
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
      return showTimePicker(booking.propertyId, booking.date!, chatId);
    case 'time':
      return confirmAndSave(booking.propertyId, booking.date!, booking.time!, chatId, userId);
    default:
      return null;
  }
}

// =============================================================================
// STEP 1: DATE PICKER
// =============================================================================

async function showDatePicker(
  propertyId: string,
  chatId: number | string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(propertyId);
  const propertyName = unit?.name ?? unit?.code ?? propertyId;
  const resolvedId = unit?.id ?? propertyId;

  const dates = getBookableDates();

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < dates.length; i += 2) {
    const row = dates.slice(i, i + 2).map(d => ({
      text: `📅 ${d.label}`,
      callback_data: encodeBookingCallback({ action: 'date', propertyId: resolvedId, date: d.date }),
    }));
    keyboard.push(row);
  }
  keyboard.push([{ text: templates.getText('booking.buttons.backToProperty'), callback_data: `detail_${resolvedId}` }]);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: templates.getText('booking.datePicker.title', { property: propertyName }),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  };
}

// =============================================================================
// STEP 2: TIME PICKER
// =============================================================================

async function showTimePicker(
  propertyIdOrSuffix: string,
  date: string,
  chatId: number | string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(propertyIdOrSuffix);
  const resolvedId = unit?.id ?? propertyIdOrSuffix;

  const companyId = getCompanyId();
  const slots = await getAvailableSlots(date, companyId);
  const dateLabel = formatDateGreek(date);

  if (slots.length === 0) {
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: templates.getText('booking.timePicker.none', { date: dateLabel }),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: templates.getText('booking.buttons.changeDate'), callback_data: `book_${resolvedId}` }],
          [{ text: templates.getText('booking.buttons.backToProperty'), callback_data: `detail_${resolvedId}` }],
        ],
      },
    };
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < slots.length; i += 3) {
    const row = slots.slice(i, i + 3).map(time => ({
      text: `🕐 ${time}`,
      callback_data: encodeBookingCallback({ action: 'time', propertyId: resolvedId, date, time }),
    }));
    keyboard.push(row);
  }
  keyboard.push([{ text: templates.getText('booking.buttons.changeDate'), callback_data: `book_${resolvedId}` }]);
  keyboard.push([{ text: templates.getText('booking.buttons.backToProperty'), callback_data: `detail_${resolvedId}` }]);

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: templates.getText('booking.timePicker.title', { date: dateLabel }),
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  };
}

// =============================================================================
// STEP 3: CONFIRM + ASK FOR CONTACT
// =============================================================================

async function confirmAndSave(
  propertyIdOrSuffix: string,
  date: string,
  time: string,
  chatId: number | string,
  userId: string,
): Promise<TelegramSendPayload> {
  const unit = await resolveUnit(propertyIdOrSuffix);
  const resolvedId = unit?.id ?? propertyIdOrSuffix;
  const propertyName = unit?.name ?? unit?.code ?? propertyIdOrSuffix;
  const dateLabel = formatDateGreek(date);

  await saveSession(userId, {
    propertyId: resolvedId,
    propertyName,
    date,
    time,
    step: 'awaiting_contact',
    createdAt: nowISO(),
  });

  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: [
      templates.getText('booking.contactPrompt.title', { property: propertyName }),
      templates.getText('booking.contactPrompt.when', { date: dateLabel, time }),
      '',
      templates.getText('booking.contactPrompt.instruction'),
      '',
      templates.getText('booking.contactPrompt.format'),
      templates.getText('booking.contactPrompt.example'),
    ].join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: templates.getText('booking.buttons.sharePhone'), request_contact: true }],
        [{ text: templates.getText('booking.buttons.cancel') }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

// =============================================================================
// SAVE APPOINTMENT TO FIRESTORE
// =============================================================================

export async function saveAppointment(
  propertyId: string,
  propertyName: string,
  date: string,
  time: string,
  chatId: number | string,
  userId: string,
  customerName: string,
  phone: string | null,
): Promise<TelegramSendPayload> {
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
        name: customerName,
        phone: phone ?? null,
        contactId: null,
        isKnownContact: false,
      },
      // ADR-869 §12 — ο ίδιος γραφέας του προγράμματος με τον αγωγό AI· η ερωτήσιμη
      // ημερομηνία δεν εξαρτάται από το ποιο κανάλι γέννησε το ραντεβού.
      appointment: withAppointmentSchedule({
        requestedDate: date,
        requestedTime: time,
        description: templates.getText('booking.visitDescription', { property: propertyName }),
        notes: `Property ID: ${propertyId}`,
      }),
      propertyId,
      propertyName,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    logger.info('Appointment booked via Telegram', {
      appointmentId, propertyId, date, time, userId, customerName, phone,
    });

    // Notify admin (fire-and-forget)
    notifyAdmin(appointmentId, propertyName, dateLabel, time, customerName, phone, chatId)
      .catch(() => { /* non-fatal */ });

    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: [
        templates.getText('booking.saved.title'),
        '',
        templates.getText('booking.saved.property', { property: propertyName }),
        templates.getText('booking.saved.date', { date: dateLabel }),
        templates.getText('booking.saved.time', { time }),
        templates.getText('booking.saved.name', { customer: customerName }),
        ...(phone ? [templates.getText('booking.saved.phone', { phone })] : []),
        '',
        templates.getText('booking.saved.footer'),
      ].join('\n'),
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    };
  } catch (error) {
    logger.error('Booking error', { error: getErrorMessage(error) });
    return {
      method: 'sendMessage',
      chat_id: chatId,
      text: templates.getText('booking.error'),
      reply_markup: { remove_keyboard: true },
    };
  }
}

// =============================================================================
// ADMIN NOTIFICATION
// =============================================================================

async function notifyAdmin(
  appointmentId: string,
  propertyName: string,
  dateLabel: string,
  time: string,
  customerName: string,
  phone: string | null,
  customerChatId: number | string,
): Promise<void> {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '5618410820';

  const { sendTelegramMessage } = await import('../telegram/client');
  await sendTelegramMessage({
    chat_id: Number(adminChatId),
    text: [
      templates.getText('booking.adminNotice.title'),
      '',
      templates.getText('booking.adminNotice.property', { property: propertyName }),
      templates.getText('booking.adminNotice.when', { date: dateLabel, time }),
      templates.getText('booking.adminNotice.customer', { customer: customerName }),
      ...(phone ? [templates.getText('booking.adminNotice.phone', { phone })] : []),
      '',
      templates.getText('booking.adminNotice.question'),
    ].join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: templates.getText('booking.buttons.confirm'), callback_data: `aa_${appointmentId.replace('ent_', '')}_${customerChatId}` },
          { text: templates.getText('booking.buttons.cancel'), callback_data: `ar_${appointmentId.replace('ent_', '')}_${customerChatId}` },
        ],
        [
          { text: templates.getText('booking.buttons.proposeChange'), callback_data: `as_${appointmentId.replace('ent_', '')}_${customerChatId}` },
        ],
      ],
    },
  });
}
