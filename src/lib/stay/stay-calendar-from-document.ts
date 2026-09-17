/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ** — αποθηκευμένο έγγραφο →
 *   κεφαλή / block / κράτηση, ή **ρητό «δεν διαβάζεται»**.
 * @related ADR-835 §20 (Στάδιο Α) · §6.4 · CHECK 3.74 · types/stay-calendar.ts ·
 *   types/stay-booking.ts · lib/calendar/date-key.ts
 * @module lib/stay/stay-calendar-from-document
 *
 * 🔴 **ΑΥΣΤΗΡΟ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ `owner-property-from-document`, ΕΠΙΤΗΔΕΣ.**
 * Εκεί ένα ελλιπές ακίνητο *«εξακολουθεί να είναι ακίνητο»* και ο κάτοχος δικαιούται
 * να το δει. Εδώ ένα ελλιπές block **δεν μπορεί να κριθεί** — και ό,τι δεν κρίνεται,
 * αν σιωπούσε, θα γινόταν **«ελεύθερο»**, δηλαδή overbooking (§6.4). Άρα ό,τι δεν
 * διαβάζεται επιστρέφει `null` και ο αναγνώστης το μετρά ως `unreadable` —
 * **ποτέ** δεν το πετά.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { isDateKey } from '@/lib/calendar/date-key';
import { isRecord } from '@/lib/type-guards';
import { stayDayRuleFrom, stayRulesFrom } from '@/lib/stay/stay-rules-shape';
import { STAY_RULES_NONE, type StayCalendarMonth, type StayDayRule } from '@/types/stay-rules';
import type { SpaceRef } from '@/lib/spaces/space-ref';
import {
  isStayBookingChannel,
  isStayBookingLifecycle,
  type StayBooking,
  type StayBookingHolder,
} from '@/types/stay-booking';
import {
  isStayBlockSource,
  STAY_CALENDAR_TIMEZONE,
  type StayBlock,
  type StayCalendarHead,
} from '@/types/stay-calendar';

type Stored = Readonly<Record<string, unknown>>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function textOrNull(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

function spaceRefsOf(value: unknown, propertyId: string): readonly SpaceRef[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const spaces: SpaceRef[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.propertyId !== propertyId) return null;
    // `null` = ολόκληρο (§4.12)· οτιδήποτε άλλο πρέπει να είναι ταυτότητα χώρου.
    const spaceId = item.spaceId === null ? null : text(item.spaceId);
    if (item.spaceId !== null && spaceId === null) return null;
    spaces.push({ propertyId, spaceId });
  }
  return spaces;
}

/** Ημι-ανοιχτό `[from, to)` με **τουλάχιστον μία** νύχτα — αλλιώς δεν είναι κατάληψη. */
function nightsRange(from: unknown, to: unknown): { from: string; to: string } | null {
  if (!isDateKey(from) || !isDateKey(to)) return null;
  return from < to ? { from, to } : null;
}

/** **Η κεφαλή.** `null` = αδιάβαστη — ο αναγνώστης την κρίνει `unreadable`, όχι `undeclared`. */
export function stayCalendarHeadFromDocument(raw: unknown, propertyId: string): StayCalendarHead | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const authorUserId = text(stored.authorUserId);
  const declaredAt = textOrNull(stored.declaredAt);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const version = stored.version;
  if (authorUserId === null || declaredAt === undefined || createdAt === null || updatedAt === null) {
    return null;
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
  // Κεφαλή πριν το Στάδιο Β: χωρίς πεδίο ⇒ ρητά «κανένας κανόνας». Παρόν αλλά άκυρο ⇒ χαλασμένη.
  const rules = stored.rules === undefined ? STAY_RULES_NONE : stayRulesFrom(stored.rules);
  if (rules === null) return null;
  return {
    propertyId,
    authorUserId,
    declaredAt,
    rules,
    version,
    timezone: STAY_CALENDAR_TIMEZONE,
    createdAt,
    updatedAt,
  };
}

/** **Κλεισμένες νύχτες.** Ταυτότητα από το έγγραφο, όπως στο ADR-839 — ποτέ από το περιεχόμενο. */
export function stayBlockFromDocument(raw: unknown, id: string): StayBlock | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const createdBy = text(stored.createdBy);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const note = textOrNull(stored.note);
  if (propertyId === null || authorUserId === null || createdBy === null) return null;
  if (createdAt === null || updatedAt === null || note === undefined) return null;
  if (!isStayBlockSource(stored.source)) return null;
  const covers = spaceRefsOf(stored.covers, propertyId);
  const range = nightsRange(stored.from, stored.to);
  if (covers === null || range === null) return null;
  return {
    id, propertyId, authorUserId, covers, ...range,
    source: stored.source, note, createdBy, createdAt, updatedAt,
  };
}

function holderOf(value: unknown): StayBookingHolder | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'user') {
    const userId = text(value.userId);
    return userId === null ? null : { kind: 'user', userId };
  }
  if (value.kind === 'offline') {
    const label = text(value.label);
    return label === null ? null : { kind: 'offline', label };
  }
  return null;
}

/** **Η κράτηση.** Χωρίς αναγνώσιμο κάτοχο, διάστημα ή κατάσταση ⇒ `null` (δες κεφαλίδα). */
export function stayBookingFromDocument(raw: unknown, id: string): StayBooking | null {
  if (!isRecord(raw)) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const createdAt = text(stored.createdAt);
  const updatedAt = text(stored.updatedAt);
  const riskDisclosedAt = textOrNull(stored.riskDisclosedAt);
  const holder = holderOf(stored.holder);
  const guests = stored.guests;
  if (propertyId === null || authorUserId === null || holder === null) return null;
  if (createdAt === null || updatedAt === null || riskDisclosedAt === undefined) return null;
  if (stored.offerKind !== 'leaseShort') return null;
  if (!isStayBookingChannel(stored.channel) || !isStayBookingLifecycle(stored.lifecycle)) return null;
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1) return null;
  const covers = spaceRefsOf(stored.covers, propertyId);
  const range = nightsRange(stored.checkIn, stored.checkOut);
  if (covers === null || range === null) return null;
  return {
    id, propertyId, offerKind: 'leaseShort', covers,
    checkIn: range.from, checkOut: range.to,
    holder, channel: stored.channel, authorUserId, guests,
    lifecycle: stored.lifecycle, riskDisclosedAt, createdAt, updatedAt,
  };
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * **Οι κανόνες ανά ημερομηνία ενός μήνα** (ADR-835 §21) — ΑΥΣΤΗΡΑ. Κάθε μέρα πρέπει να ανήκει
 * στον μήνα του εγγράφου· μία άκυρη μέρα ⇒ όλο το έγγραφο `null` ⇒ ημερολόγιο `unreadable`
 * (μια τιμή ή ένα CTA που δεν διαβάστηκε **δεν** είναι «κανένας κανόνας»).
 */
export function stayCalendarMonthFromDocument(raw: unknown, id: string): StayCalendarMonth | null {
  if (!isRecord(raw) || id.length === 0) return null;
  const stored: Stored = raw;
  const propertyId = text(stored.propertyId);
  const authorUserId = text(stored.authorUserId);
  const updatedAt = text(stored.updatedAt);
  const month = stored.month;
  if (propertyId === null || authorUserId === null || updatedAt === null) return null;
  if (typeof month !== 'string' || !MONTH_KEY.test(month) || !isRecord(stored.days)) return null;
  const days: Record<string, StayDayRule> = {};
  for (const [dateKey, value] of Object.entries(stored.days)) {
    if (!isDateKey(dateKey) || !dateKey.startsWith(`${month}-`)) return null;
    const rule = stayDayRuleFrom(value);
    if (rule === null) return null;
    days[dateKey] = rule;
  }
  return { propertyId, authorUserId, month, days, updatedAt };
}
