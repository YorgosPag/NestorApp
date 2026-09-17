/**
 * @fileoverview **ΤΙ ΡΩΤΑ Ο ΑΝΩΝΥΜΟΣ ΕΠΙΣΚΕΠΤΗΣ** — ο ΕΝΑΣ αναλυτής των δημόσιων ερωτημάτων διαθεσιμότητας.
 * @related ADR-835 §21 · app/api/public-listings/[listingId]/stay-nights/route.ts ·
 *   app/api/public-listings/stay-availability/route.ts
 * @module lib/stay/stay-public-request
 *
 * ⚠️ Δημόσια πόρτα ⇒ **κλειστά όρια** σε κάθε διάσταση (πόσες αγγελίες, πόσοι μήνες, πόσες
 * νύχτες), ώστε ένα αίτημα να μη μπορεί να ζητήσει αυθαίρετα μεγάλη δουλειά.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import { isRecord } from '@/lib/type-guards';

import type { StayAvailabilityAnswer, StayQuery } from './stay-availability-vocabulary';
import type { StayQuote } from './stay-nightly-quote';
import { STAY_BOOKING_MAX_GUESTS, STAY_BOOKING_MAX_NIGHTS } from './stay-calendar-command';

/** Μέγιστοι μήνες σε ένα αίτημα ημερολογίου (Airbnb: 2 ορατοί + 1 προφόρτωση). */
export const STAY_PUBLIC_MAX_MONTHS = 3;
/** Μέγιστες αγγελίες σε μία απάντηση αναζήτησης — μία σελίδα αποτελεσμάτων. */
export const STAY_PUBLIC_MAX_LISTINGS = 60;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const LISTING_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type StayPublicParse<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly malformed: readonly string[] };

/** `?from=YYYY-MM&months=1..3` */
export function stayNightsRequestFrom(
  from: string | null,
  months: string | null,
): StayPublicParse<{ readonly fromMonth: string; readonly months: number }> {
  const count = months === null ? 1 : Number(months);
  const bad: string[] = [];
  if (from === null || !MONTH_KEY.test(from)) bad.push('from');
  if (!Number.isInteger(count) || count < 1 || count > STAY_PUBLIC_MAX_MONTHS) bad.push('months');
  if (bad.length > 0 || from === null) return { ok: false, malformed: bad };
  return { ok: true, value: { fromMonth: from, months: count } };
}

/** `true` αν η τιμή είναι αποδεκτή ταυτότητα αγγελίας για δημόσιο αίτημα. */
export function isPublicListingId(value: unknown): value is string {
  return typeof value === 'string' && LISTING_ID.test(value);
}

function queryOf(body: Readonly<Record<string, unknown>>): StayQuery | null {
  const { checkIn, checkOut, guests } = body;
  if (!isDateKey(checkIn) || !isDateKey(checkOut)) return null;
  const nights = daysBetweenDateKeys(checkIn, checkOut);
  if (nights === null || nights < 1 || nights > STAY_BOOKING_MAX_NIGHTS) return null;
  if (guests === null) return { checkIn, checkOut, guests: null };
  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1 || guests > STAY_BOOKING_MAX_GUESTS) {
    return null;
  }
  return { checkIn, checkOut, guests };
}

/** Σώμα `{ listingIds, checkIn, checkOut, guests }`. */
export function stayAnswersRequestFrom(
  raw: unknown,
): StayPublicParse<{ readonly listingIds: readonly string[]; readonly query: StayQuery }> {
  if (!isRecord(raw)) return { ok: false, malformed: ['body'] };
  const ids = raw.listingIds;
  const query = queryOf(raw);
  const bad: string[] = [];
  const idsValid = Array.isArray(ids) && ids.length >= 1 && ids.length <= STAY_PUBLIC_MAX_LISTINGS
    && ids.every(isPublicListingId) && new Set(ids).size === ids.length;
  if (!idsValid) bad.push('listingIds');
  if (query === null) bad.push('checkIn', 'checkOut', 'guests');
  if (bad.length > 0 || query === null || !Array.isArray(ids)) return { ok: false, malformed: bad };
  return { ok: true, value: { listingIds: ids.filter(isPublicListingId), query } };
}

/** Η απάντηση για μία αγγελία σε ένα ερώτημα διαμονής — το συμβόλαιο της δημόσιας διαδρομής. */
export interface PublicStayAnswer {
  readonly answer: StayAvailabilityAnswer;
  /** `null` όταν δεν είναι κατάλυμα ή το ερώτημα δεν τιμολογείται. */
  readonly quote: StayQuote | null;
}
