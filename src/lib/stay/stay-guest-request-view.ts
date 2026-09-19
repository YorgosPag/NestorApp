/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΟΠΩΣ ΤΟ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ** — το σχήμα του σύρματος, κοινό για διακομιστή και οθόνη.
 * @related ADR-835 §23.5 · app/api/public-listings/[listingId]/stay-request/route.ts ·
 *   services/stay-calendar/stay-guest-requests.service.ts · lib/stay/stay-calendar-view.ts (η όψη του οικοδεσπότη)
 * @module lib/stay/stay-guest-request-view
 *
 * 🔑 **ΠΡΟΒΟΛΗ, ΟΧΙ ΤΟ ΕΓΓΡΑΦΟ** — ίδιο ιδίωμα με το `stay-calendar-view`: ό,τι δεν γράφεται εδώ δεν
 * φεύγει από τον διακομιστή. Ο επισκέπτης **δεν** βλέπει ποιος οφείλει την απάντηση, ούτε τη βαθμίδα,
 * ούτε το `authorUserId` — βλέπει **τη δική του υπόσχεση**: τις ημερομηνίες και ως πότε κρατιούνται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { isRecord } from '@/lib/type-guards';
import {
  isStayBookingLifecycle,
  stayBookingOccupiesAt,
  type StayBooking,
  type StayBookingLifecycle,
} from '@/types/stay-booking';

export interface StayGuestRequestView {
  readonly id: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guests: number;
  /** Το σύνολο που **παγώθηκε** στο αίτημα (ADR-777 §8.60.21.7) — `null` = δεν τιμολογήθηκε. */
  readonly totalMinor: MinorAmount | null;
  readonly lifecycle: StayBookingLifecycle;
  /** Ως πότε κρατιούνται οι μέρες — `null` αν δεν γεννήθηκε ως αίτημα. */
  readonly holdExpiresAt: string | null;
  /**
   * **Ζει ακόμη;** — `requested` με ζωντανό hold. Ένα αίτημα που έληξε πριν τρέξει το cron είναι ακόμη
   * `requested` στον δίσκο, αλλά **δεν** είναι σε αναμονή: η οθόνη λέει «έληξε», όχι «σε αναμονή».
   */
  readonly pending: boolean;
}

/** Η προβολή ενός αιτήματος τη στιγμή `instant`. */
export function stayGuestRequestViewOf(booking: StayBooking, instant: string): StayGuestRequestView {
  return {
    id: booking.id,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: booking.guests,
    totalMinor: booking.price?.totalMinor ?? null,
    lifecycle: booking.lifecycle,
    holdExpiresAt: booking.hold?.expiresAt ?? null,
    pending: booking.lifecycle === 'requested' && stayBookingOccupiesAt(booking, instant),
  };
}

/** Η απάντηση του `GET` — `unreadable` ποτέ δεν γίνεται «κανένα αίτημα» (N.12). */
export type StayGuestRequests =
  | { readonly kind: 'readable'; readonly requests: readonly StayGuestRequestView[] }
  | { readonly kind: 'unreadable' };

function requestViewFrom(raw: unknown): StayGuestRequestView | null {
  if (!isRecord(raw)) return null;
  const { id, checkIn, checkOut, guests, totalMinor, lifecycle, holdExpiresAt, pending } = raw;
  if (typeof id !== 'string' || typeof checkIn !== 'string' || typeof checkOut !== 'string') return null;
  if (typeof guests !== 'number' || !isStayBookingLifecycle(lifecycle) || typeof pending !== 'boolean') return null;
  if (holdExpiresAt !== null && typeof holdExpiresAt !== 'string') return null;
  if (totalMinor !== null && !isMinorAmount(totalMinor)) return null;
  return { id, checkIn, checkOut, guests, totalMinor, lifecycle, holdExpiresAt, pending };
}

/** **Από το σύρμα** — άγνωστο σχήμα ⇒ `null` (ο καλών το λέει «απέτυχε»). */
export function stayGuestRequestsFrom(raw: unknown): StayGuestRequests | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'unreadable') return { kind: 'unreadable' };
  if (raw.kind !== 'readable' || !Array.isArray(raw.requests)) return null;
  const requests: StayGuestRequestView[] = [];
  for (const item of raw.requests) {
    const view = requestViewFrom(item);
    if (view === null) return null;
    requests.push(view);
  }
  return { kind: 'readable', requests };
}
