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
    return { method: 'sendMessage', chat_id: adminChatId, text: '❌ Το ραντεβού δεν βρέθηκε.' };
  }

  const apptData = appointmentDoc.data();
  const propertyName = apptData?.propertyName ?? 'Ακίνητο';
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
  await appointmentRef.update({
    status: 'approved',
    'appointment.confirmedDate': requestedDate,
    'appointment.confirmedTime': requestedTime,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: [
      '✅ <b>Το ραντεβού σας επιβεβαιώθηκε!</b>',
      '',
      `🏠 ${propertyName}`,
      `📅 ${dateLabel} στις ${requestedTime}`,
      '',
      'Σας περιμένουμε! 😊',
    ].join('\n'),
    parse_mode: 'HTML',
  });

  return {
    method: 'sendMessage',
    chat_id: adminChatId,
    text: `✅ Ραντεβού <b>επιβεβαιώθηκε</b> — ${propertyName}, ${dateLabel} ${requestedTime}.\nΟ πελάτης ειδοποιήθηκε.`,
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
    updatedAt: new Date().toISOString(),
  });

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: [
      '😔 <b>Το ραντεβού σας δεν μπόρεσε να επιβεβαιωθεί.</b>',
      '',
      `🏠 ${propertyName}`,
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
    text: `❌ Ραντεβού <b>ακυρώθηκε</b> — ${propertyName}, ${dateLabel} ${requestedTime}.\nΟ πελάτης ειδοποιήθηκε.`,
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
    updatedAt: new Date().toISOString(),
  });

  await sendTelegramMessage({
    chat_id: Number(customerChatId),
    text: [
      '🔄 <b>Αλλαγή ραντεβού</b>',
      '',
      `Η ώρα ${requestedTime} στις ${dateLabel} δεν είναι διαθέσιμη για το ${propertyName}.`,
      '',
      'Παρακαλώ επιλέξτε νέα ημερομηνία:',
    ].join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Επιλογή νέας ημερομηνίας', callback_data: `book_${propertyId ?? ''}` }],
        [{ text: '📞 Επικοινωνία', callback_data: 'contact_agent' }],
      ],
    },
  });

  return {
    method: 'sendMessage',
    chat_id: adminChatId,
    text: `🔄 Ο πελάτης ειδοποιήθηκε να επιλέξει νέα ημερομηνία για ${propertyName}.`,
    parse_mode: 'HTML',
  };
}
