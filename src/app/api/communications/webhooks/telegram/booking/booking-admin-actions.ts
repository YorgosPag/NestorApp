/**
 * =============================================================================
 * BOOKING ADMIN ACTIONS — Approve / Reject / Reschedule
 * =============================================================================
 *
 * Handles admin-side appointment management via Telegram callbacks.
 *
 * @module api/communications/webhooks/telegram/booking/booking-admin-actions
 */

import type { TelegramSendPayload, TelegramSendResult } from '../telegram/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { formatDateGreek } from './booking-codec';
import { nowISO } from '@/lib/date-local';
import { appointmentConfirmationPatch } from '@/services/appointments/appointment-schedule';
// ADR-869 §13 — ο ΕΝΑΣ μεταφραστής του bot (ήδη σε χρήση από `search/` και `templates/`).
import { TelegramTemplateResolver } from '../templates/template-resolver';

const templates = new TelegramTemplateResolver();

// =============================================================================
// CALLBACK PARSER
// =============================================================================

function parseAdminCallback(data: string): { action: string; appointmentIdSuffix: string; customerChatId: string } | null {
  const match = data.match(/^(aa|ar|as)_([^_]+)_(.+)$/);
  if (!match) return null;
  const actionMap: Record<string, string> = { aa: 'approve', ar: 'reject', as: 'reschedule' };
  return { action: actionMap[match[1]], appointmentIdSuffix: match[2], customerChatId: match[3] };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function handleAdminAppointmentAction(
  data: string,
  adminChatId: number | string,
): Promise<TelegramSendPayload | null> {
  const parsed = parseAdminCallback(data);
  if (!parsed) return null;

  const { action, appointmentIdSuffix, customerChatId } = parsed;
  const db = getAdminFirestore();

  const fullId = `ent_${appointmentIdSuffix}`;
  const appointmentRef = db.collection(COLLECTIONS.APPOINTMENTS).doc(fullId);
  const appointmentDoc = await appointmentRef.get();

  if (!appointmentDoc.exists) {
    return { method: 'sendMessage', chat_id: adminChatId, text: templates.getText('booking.notFound') };
  }

  const apptData = appointmentDoc.data();
  const propertyName = apptData?.propertyName ?? templates.getText('booking.unnamedProperty');
  const requestedDate = apptData?.appointment?.requestedDate ?? '';
  const requestedTime = apptData?.appointment?.requestedTime ?? '';
  const dateLabel = requestedDate ? formatDateGreek(requestedDate) : '';

  const { sendTelegramMessage } = await import('../telegram/client');

  switch (action) {
    case 'approve':
      return handleApprove(appointmentRef, propertyName, dateLabel, requestedDate, requestedTime, customerChatId, adminChatId, sendTelegramMessage);
    case 'reject':
      return handleReject(appointmentRef, propertyName, dateLabel, requestedTime, customerChatId, adminChatId, sendTelegramMessage);
    case 'reschedule':
      return handleReschedule(appointmentRef, propertyName, dateLabel, requestedTime, apptData?.propertyId, customerChatId, adminChatId, sendTelegramMessage);
    default:
      return null;
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

type SendFn = (payload: TelegramSendPayload) => Promise<TelegramSendResult>;

async function handleApprove(
  appointmentRef: FirebaseFirestore.DocumentReference,
  propertyName: string,
  dateLabel: string,
  requestedDate: string,
  requestedTime: string,
  customerChatId: string,
  adminChatId: number | string,
  sendTelegramMessage: SendFn,
): Promise<TelegramSendPayload> {
  // ADR-869 §12 — ΜΙΑ ατομική εγγραφή: το επιβεβαιωμένο και το ερωτήσιμο μετακινούνται
  // ΜΑΖΙ. Τα δύο dotted κλειδιά γράφονταν εδώ με το χέρι· τίποτα δεν θα εμπόδιζε έναν
  // τέταρτο γραφέα να γράψει μόνο το `confirmedDate` και να αφήσει το ημερολόγιο να λέει
  // άλλα από το έγγραφο.
  await appointmentRef.update({
    status: 'approved',
    ...appointmentConfirmationPatch(requestedDate, requestedTime),
    approvedAt: nowISO(),
    updatedAt: nowISO(),
  });

  const params = { property: propertyName, date: dateLabel, time: requestedTime };

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: templates.getText('booking.approved.customer', params),
    parse_mode: 'HTML',
  });

  return {
    method: 'sendMessage',
    chat_id: adminChatId,
    text: templates.getText('booking.approved.admin', params),
    parse_mode: 'HTML',
  };
}

async function handleReject(
  appointmentRef: FirebaseFirestore.DocumentReference,
  propertyName: string,
  dateLabel: string,
  requestedTime: string,
  customerChatId: string,
  adminChatId: number | string,
  sendTelegramMessage: SendFn,
): Promise<TelegramSendPayload> {
  await appointmentRef.update({
    status: 'rejected',
    updatedAt: nowISO(),
  });

  const params = { property: propertyName, date: dateLabel, time: requestedTime };

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: templates.getText('booking.rejected.customer', params),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: templates.getText('booking.buttons.newAppointment'), callback_data: 'new_search' }],
        [{ text: templates.getText('booking.buttons.contact'), callback_data: 'contact_agent' }],
      ],
    },
  });

  return {
    method: 'sendMessage',
    chat_id: adminChatId,
    text: templates.getText('booking.rejected.admin', params),
    parse_mode: 'HTML',
  };
}

async function handleReschedule(
  appointmentRef: FirebaseFirestore.DocumentReference,
  propertyName: string,
  dateLabel: string,
  requestedTime: string,
  propertyId: string | undefined,
  customerChatId: string,
  adminChatId: number | string,
  sendTelegramMessage: SendFn,
): Promise<TelegramSendPayload> {
  await appointmentRef.update({
    status: 'rescheduled',
    updatedAt: nowISO(),
  });

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: templates.getText('booking.rescheduled.customer', {
      property: propertyName,
      date: dateLabel,
      time: requestedTime,
    }),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: templates.getText('booking.buttons.pickNewDate'), callback_data: `book_${propertyId ?? ''}` }],
        [{ text: templates.getText('booking.buttons.contact'), callback_data: 'contact_agent' }],
      ],
    },
  });

  return {
    method: 'sendMessage',
    chat_id: adminChatId,
    text: templates.getText('booking.rescheduleAck', { property: propertyName }),
    parse_mode: 'HTML',
  };
}
