/**
 * @fileoverview **Η ΚΕΦΑΛΗ ΤΟΥ ΕΠΙΣΚΕΠΤΗ** — τα ζωντανά αιτήματα ενός ανθρώπου, και το όριό τους.
 * @related ADR-835 §20.3 #3 · §23.4 · types/stay-calendar.ts (`StayCalendarHead`, το κάτοπτρο) ·
 *   services/stay-calendar/stay-calendar-request-write.ts
 * @module lib/stay/stay-guest-head
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΓΓΡΑΦΟ, ΚΑΙ ΟΧΙ ΕΝΑ ΕΡΩΤΗΜΑ «ΠΟΣΑ ΑΙΤΗΜΑΤΑ ΕΧΕΙ;»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο phantom insert που έλυσε η κεφαλή του ακινήτου (§20): η Firestore κλειδώνει τα
 * **έγγραφα** που διάβασε μια συναλλαγή, όχι το **εύρος** ενός ερωτήματος. Δύο παράλληλα αιτήματα
 * του ίδιου ανθρώπου σε **δύο διαφορετικά** ακίνητα (δύο διαφορετικές κεφαλές ακινήτου!) θα
 * μετρούσαν και τα δύο «2 ζωντανά» και θα γινόταν «4 > 3». Με αυτό το έγγραφο στη συναλλαγή, η
 * δεύτερη **ξαναπαίζεται** και βλέπει την πρώτη.
 *
 * 🏆 **Η αγορά δεν έχει κανένα τέτοιο όριο** (έρευνα 2026-09-18)· η κατάχρηση «κλειδώνω όλο το
 * καλοκαίρι» του §6.1 γίνεται εδώ **αδύνατη να εκφραστεί**, όχι απλώς απίθανη.
 *
 * 🔑 **Μετρά ΜΟΝΟ ζωντανά holds** — ένα hold που έληξε δεν κρατά μέρες, άρα δεν κρατά ούτε θέση
 * στο όριο, με ή χωρίς cron (ίδια αρχή με το `stayBookingOccupiesAt`).
 *
 * **Layering**: leaf — καθαροί τύποι + καθαρές συναρτήσεις, μηδέν I/O.
 */

import { isRecord } from '@/lib/type-guards';
import { stayHoldLivesAt } from '@/types/stay-booking';

/** Πόσα **ζωντανά** αιτήματα μπορεί να έχει ένας άνθρωπος ταυτόχρονα. */
export const STAY_GUEST_MAX_ACTIVE_HOLDS = 3;

/** Ένα αίτημα που κρατά θέση στο όριο. */
export interface StayGuestHold {
  readonly bookingId: string;
  readonly propertyId: string;
  /** ISO — ίδια τιμή με το `StayHold.expiresAt` της κράτησης. */
  readonly expiresAt: string;
}

/** `stay_guests/{uid}`. */
export interface StayGuestHead {
  readonly userId: string;
  readonly holds: readonly StayGuestHold[];
  readonly version: number;
  readonly updatedAt: string;
}

/** Τα holds που **ζουν** τη στιγμή `instant`. */
export function liveGuestHolds(head: StayGuestHead | null, instant: string): readonly StayGuestHold[] {
  return (head?.holds ?? []).filter((hold) => stayHoldLivesAt(hold, instant));
}

/** `true` αν ο άνθρωπος **δεν** χωρά άλλο αίτημα τη στιγμή `instant`. */
export function guestHoldLimitReached(head: StayGuestHead | null, instant: string): boolean {
  return liveGuestHolds(head, instant).length >= STAY_GUEST_MAX_ACTIVE_HOLDS;
}

function nextHead(
  head: StayGuestHead | null,
  userId: string,
  holds: readonly StayGuestHold[],
  now: string,
): StayGuestHead {
  return { userId, holds, version: (head?.version ?? 0) + 1, updatedAt: now };
}

/** Η κεφαλή **με** ένα νέο αίτημα — τα νεκρά κλαδεύονται στο ίδιο πέρασμα. */
export function guestHeadWithHold(
  head: StayGuestHead | null,
  userId: string,
  hold: StayGuestHold,
  now: string,
): StayGuestHead {
  const kept = liveGuestHolds(head, now).filter((existing) => existing.bookingId !== hold.bookingId);
  return nextHead(head, userId, [...kept, hold], now);
}

/** Η κεφαλή **χωρίς** το αίτημα `bookingId` (απαντήθηκε, αποσύρθηκε ή έληξε). */
export function guestHeadWithoutHold(
  head: StayGuestHead | null,
  userId: string,
  bookingId: string,
  now: string,
): StayGuestHead {
  return nextHead(head, userId, liveGuestHolds(head, now).filter((hold) => hold.bookingId !== bookingId), now);
}

function guestHoldOf(value: unknown): StayGuestHold | null {
  if (!isRecord(value)) return null;
  const { bookingId, propertyId, expiresAt } = value;
  if (typeof bookingId !== 'string' || bookingId.length === 0) return null;
  if (typeof propertyId !== 'string' || propertyId.length === 0) return null;
  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) return null;
  return { bookingId, propertyId, expiresAt };
}

/**
 * **Η κεφαλή από τον δίσκο** — αυστηρά: ένα χαλασμένο hold ⇒ όλο `null` ⇒ ο γραφέας **αρνείται**.
 * 🔴 Ποτέ «μετράω όσα διαβάζονται»: ένα όριο που χάνει σιωπηλά εγγραφές είναι όριο που δεν ισχύει.
 */
export function stayGuestHeadFromDocument(raw: unknown, userId: string): StayGuestHead | null {
  if (!isRecord(raw) || raw.userId !== userId || !Array.isArray(raw.holds)) return null;
  const { version, updatedAt } = raw;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
  if (typeof updatedAt !== 'string') return null;
  const holds: StayGuestHold[] = [];
  for (const item of raw.holds) {
    const hold = guestHoldOf(item);
    if (hold === null) return null;
    holds.push(hold);
  }
  return { userId, holds, version, updatedAt };
}
