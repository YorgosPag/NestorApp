/**
 * =============================================================================
 * BOOKING CALLBACK CODEC — Type-safe encoding/decoding + unit resolver
 * =============================================================================
 *
 * @module api/communications/webhooks/telegram/booking/booking-codec
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// CALLBACK DATA CODEC
// =============================================================================

const SEPARATOR = '|';

export interface BookingCallbackData {
  action: 'date' | 'time' | 'confirm';
  propertyId: string;
  /** @deprecated Use propertyId — kept for backward compat decoding */
  unitId?: string;
  date?: string;   // YYYY-MM-DD
  time?: string;   // HH:mm
}

/** Encode booking callback data into a compact string (max 64 bytes for Telegram) */
export function encodeBookingCallback(data: BookingCallbackData): string {
  const id = data.propertyId ?? data.unitId ?? '';
  const parts = [`bk${data.action.charAt(0)}`, id.slice(-12)];
  if (data.date) parts.push(data.date);
  if (data.time) parts.push(data.time);
  return parts.join(SEPARATOR);
}

/** Decode booking callback data from string */
export function decodeBookingCallback(raw: string): BookingCallbackData | null {
  const parts = raw.split(SEPARATOR);
  if (parts.length < 2) return null;

  const actionMap: Record<string, BookingCallbackData['action']> = {
    'bkd': 'date',
    'bkt': 'time',
    'bkc': 'confirm',
  };

  const action = actionMap[parts[0]];
  if (!action) return null;

  return {
    action,
    propertyId: parts[1],
    date: parts[2],
    time: parts[3],
  };
}

/** Check if callback data is a booking callback */
export function isBookingCallback(data: string): boolean {
  return data.startsWith('bkd') || data.startsWith('bkt') || data.startsWith('bkc')
    || data.startsWith('book_') || data.startsWith('aa_') || data.startsWith('ar_') || data.startsWith('as_');
}

// =============================================================================
// UNIT RESOLVER
// =============================================================================

export interface PropertyInfo {
  id: string;
  name: string;
  code: string;
}

/** @deprecated Use PropertyInfo */
export type UnitInfo = PropertyInfo;

/** Resolve property by full ID or short ID suffix */
export async function resolveUnit(unitIdOrSuffix: string): Promise<PropertyInfo | null> {
  const db = getAdminFirestore();

  // Exact match
  const doc = await db.collection(COLLECTIONS.PROPERTIES).doc(unitIdOrSuffix).get();
  if (doc.exists) {
    const d = doc.data();
    return { id: doc.id, name: String(d?.name ?? ''), code: String(d?.code ?? '') };
  }

  // Suffix match (for short IDs in callbacks)
  const snap = await db.collection(COLLECTIONS.PROPERTIES).limit(50).get();
  const match = snap.docs.find(d => d.id.endsWith(unitIdOrSuffix));
  if (match) {
    const d = match.data();
    return { id: match.id, name: String(d?.name ?? ''), code: String(d?.code ?? '') };
  }

  return null;
}

// =============================================================================
// GREEK DATE HELPERS
// =============================================================================

const DAY_NAMES_FULL = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

export function formatDateGreek(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
