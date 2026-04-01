/**
 * =============================================================================
 * BOOKING SESSION — Firestore-backed multi-step state per user
 * =============================================================================
 *
 * Manages booking session lifecycle:
 * - Save/get/delete sessions in Firestore
 * - TTL-based expiration (10 min)
 * - Handle contact input (text or shared contact)
 *
 * @module api/communications/webhooks/telegram/booking/booking-session
 */

import type { TelegramSendPayload } from '../telegram/types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { saveAppointment } from './booking-handlers';

// =============================================================================
// TYPES
// =============================================================================

export interface BookingSession {
  propertyId: string;
  propertyName: string;
  date: string;
  time: string;
  step: 'awaiting_contact';
  createdAt: string;
}

const BOOKING_SESSIONS_COLLECTION = 'booking_sessions';
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// =============================================================================
// SESSION CRUD
// =============================================================================

export async function hasActiveBookingSession(userId: string): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    const doc = await db.collection(BOOKING_SESSIONS_COLLECTION).doc(userId).get();
    if (!doc.exists) return false;
    const data = doc.data() as BookingSession;
    const age = Date.now() - new Date(data.createdAt).getTime();
    if (age > SESSION_TTL_MS) {
      await doc.ref.delete().catch(() => {});
      return false;
    }
    return data.step === 'awaiting_contact';
  } catch {
    return false;
  }
}

export async function saveSession(userId: string, session: BookingSession): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(BOOKING_SESSIONS_COLLECTION).doc(userId).set(session);
}

export async function deleteSession(userId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(BOOKING_SESSIONS_COLLECTION).doc(userId).delete().catch(() => {});
}

export async function getSession(userId: string): Promise<BookingSession | null> {
  try {
    const db = getAdminFirestore();
    const doc = await db.collection(BOOKING_SESSIONS_COLLECTION).doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as BookingSession;
  } catch {
    return null;
  }
}

// =============================================================================
// CONTACT INPUT HANDLERS
// =============================================================================

/**
 * Handle text input during booking session (user provides name + phone).
 */
export async function handleBookingContactInput(
  userId: string,
  chatId: number | string,
  text: string,
  firstName?: string,
  lastName?: string,
): Promise<TelegramSendPayload | null> {
  const session = await getSession(userId);
  if (!session) return null;

  const telegramName = [firstName, lastName].filter(Boolean).join(' ');
  const inputParts = text.trim().split(/\s+/);

  const phonePattern = /\d{10,}/;
  const phoneMatch = text.match(phonePattern);
  const phone = phoneMatch ? phoneMatch[0] : null;

  const nameFromInput = inputParts.filter(p => !phonePattern.test(p)).join(' ');
  const customerName = nameFromInput.length >= 2 ? nameFromInput : telegramName || `User ${userId}`;

  const result = await saveAppointment(
    session.propertyId, session.propertyName, session.date, session.time,
    chatId, userId, customerName, phone,
  );

  await deleteSession(userId);
  return result;
}

/**
 * Handle shared contact (Telegram request_contact button).
 */
export async function handleBookingSharedContact(
  userId: string,
  chatId: number | string,
  phoneNumber: string,
  firstName?: string,
  lastName?: string,
): Promise<TelegramSendPayload | null> {
  const session = await getSession(userId);
  if (!session) return null;

  const customerName = [firstName, lastName].filter(Boolean).join(' ') || `User ${userId}`;

  const result = await saveAppointment(
    session.propertyId, session.propertyName, session.date, session.time,
    chatId, userId, customerName, phoneNumber,
  );

  await deleteSession(userId);
  return result;
}
