/**
 * @fileoverview **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΟΠΩΣ ΤΟ ΒΛΕΠΕΙ Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — το σχήμα
 *   του σύρματος, κοινό για διακομιστή και οθόνη.
 * @related ADR-835 §20 (Στάδιο Α) · services/stay-calendar/stay-calendar-read.service.ts ·
 *   components/stay-calendar/*
 * @module lib/stay/stay-calendar-view
 *
 * 🔑 **ΠΡΟΒΟΛΗ, ΟΧΙ ΤΟ ΕΓΓΡΑΦΟ.** Ό,τι δεν γράφεται εδώ δεν φεύγει από τον διακομιστή:
 * ούτε `authorUserId`, ούτε `createdBy`, ούτε `covers`. Στο Στάδιο Ε (διαχειριστές) η
 * ίδια προβολή θα **στενέψει** ανά θεατή — γι' αυτό υπάρχει ως συνάρτηση και όχι ως
 * `JSON.stringify` του εγγράφου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { intervalsOverlap } from '@/lib/date-local';
import type { MinorAmount } from '@/lib/money/money';
import type { StayDayRule, StayDayRules, StayRules } from '@/types/stay-rules';
import type { StayBookingChannel, StayBookingLifecycle } from '@/types/stay-booking';
import { stayEntryOccupies, type StayBlockSource, type StayCalendarEntry } from '@/types/stay-calendar';

export type StayCalendarEntryView =
  | {
      readonly kind: 'block';
      readonly id: string;
      readonly from: string;
      readonly to: string;
      readonly source: StayBlockSource;
      readonly note: string | null;
    }
  | {
      readonly kind: 'booking';
      readonly id: string;
      readonly from: string;
      readonly to: string;
      readonly guests: number;
      /** Κατοικίδια (ADR-777 §8.60.21.7): `0` = κανένα· `null` = δεν ρωτήθηκε (πριν τη Φ5). */
      readonly pets: number | null;
      /** Το σύνολο που υποσχέθηκε η πλατφόρμα στο αίτημα — στιγμιότυπο· `null` = δεν τιμολογήθηκε. */
      readonly totalMinor: MinorAmount | null;
      /**
       * Ποιον βλέπει ο οικοδεσπότης: η ιδιωτική του σημείωση (χειροκίνητη κράτηση) ή το όνομα
       * του λογαριασμού τη στιγμή του αιτήματος (Στάδιο Δ). Ποτέ uid, ποτέ email· `null` = χωρίς όνομα.
       */
      readonly guestLabel: string | null;
      readonly channel: StayBookingChannel;
      readonly lifecycle: StayBookingLifecycle;
      /** Πιάνει νύχτες **τώρα**; — από τη **μία** πηγή (`stayEntryOccupies`), ποτέ ξαναγραμμένο στην οθόνη. */
      readonly occupies: boolean;
      /** Η προθεσμία απάντησης, αν γεννήθηκε ως αίτημα (§23.3)· αλλιώς `null`. */
      readonly holdExpiresAt: string | null;
      /** Πότε ειπώθηκε στον επισκέπτη ότι το ακίνητο πωλείται (§4.7)· `null` = δεν ίσχυε. */
      readonly riskDisclosedAt: string | null;
    };

/**
 * **Η απάντηση της ανάγνωσης.** Το `unreadable` είναι **κατάσταση οθόνης**, όχι σφάλμα
 * δικτύου: ο οικοδεσπότης πρέπει να ξέρει ότι *«κάτι στο ημερολόγιο δεν διαβάζεται»* αντί
 * να βλέπει άδειες μέρες που δεν είναι άδειες.
 */
export type StayCalendarView =
  | {
      readonly kind: 'readable';
      readonly declaredAt: string | null;
      readonly version: number;
      readonly entries: readonly StayCalendarEntryView[];
      /** Οι κανόνες βάσης (Στάδιο Β). */
      readonly rules: StayRules;
      /** Οι υπερβάσεις ανά ημερομηνία **μέσα στο παράθυρο** της οθόνης. */
      readonly days: StayDayRules;
      /**
       * 🔴 **Τα ζωντανά αιτήματα — ΧΩΡΙΣ παράθυρο** (Στάδιο Δ, §23.8). Οι `entries` κόβονται στους
       * 2–3 μήνες της οθόνης· ένα αίτημα για τον Αύγουστο θα ήταν **αόρατο** ώσπου ο οικοδεσπότης να
       * πάει τυχαία εκεί — και θα έληγε χωρίς να το δει. Το «εισερχόμενο» αιτημάτων δεν έχει μήνα.
       */
      readonly pendingRequests: readonly StayCalendarEntryView[];
    }
  | { readonly kind: 'unreadable' };

/**
 * **Η προβολή μιας εγγραφής τη στιγμή `instant`** — η στιγμή κρίνει αν ένα αίτημα **ζει ακόμη**
 * (`occupies`), ώστε η οθόνη να μη δείχνει ως «σε αναμονή» αίτημα που έληξε πριν τρέξει το cron.
 */
export function stayCalendarEntryViewOf(entry: StayCalendarEntry, instant: string): StayCalendarEntryView {
  if (entry.kind === 'block') {
    const { block } = entry;
    return { kind: 'block', id: block.id, from: block.from, to: block.to, source: block.source, note: block.note };
  }
  const { booking } = entry;
  return {
    kind: 'booking',
    id: booking.id,
    from: booking.checkIn,
    to: booking.checkOut,
    guests: booking.guests,
    pets: booking.pets,
    totalMinor: booking.price?.totalMinor ?? null,
    guestLabel: booking.holder.kind === 'offline' ? booking.holder.label : booking.holder.displayName,
    channel: booking.channel,
    lifecycle: booking.lifecycle,
    occupies: stayEntryOccupies(entry, instant),
    holdExpiresAt: booking.hold?.expiresAt ?? null,
    riskDisclosedAt: booking.riskDisclosedAt,
  };
}

/** Τα **ζωντανά** αιτήματα, η πιο επείγουσα προθεσμία πρώτη — το εισερχόμενο του οικοδεσπότη. */
export function stayPendingRequestsOf(entries: readonly StayCalendarEntryView[]): readonly StayCalendarEntryView[] {
  return entries
    .filter((entry) => entry.kind === 'booking' && entry.lifecycle === 'requested' && entry.occupies)
    .sort((a, b) => {
      const left = a.kind === 'booking' ? a.holdExpiresAt ?? '' : '';
      const right = b.kind === 'booking' ? b.holdExpiresAt ?? '' : '';
      return left === right ? a.id.localeCompare(b.id) : left < right ? -1 : 1;
    });
}

/**
 * Οι εγγραφές που αγγίζουν το παράθυρο `[windowFrom, windowTo)`, ταξινομημένες κατά αρχή.
 *
 * ⚠️ Ο τελεστής επικάλυψης είναι ο **ένας** (`intervalsOverlap`, ADR-749). `null`
 * («δεν κρίνεται») ⇒ **δείχνεται**: μια εγγραφή που δεν ξέρουμε πού πέφτει δεν κρύβεται.
 */
export function stayEntriesWithin(
  entries: readonly StayCalendarEntryView[],
  windowFrom: string,
  windowTo: string,
): readonly StayCalendarEntryView[] {
  return entries
    .filter((entry) => intervalsOverlap(entry.from, entry.to, windowFrom, windowTo) !== false)
    .sort((a, b) => (a.from === b.from ? a.id.localeCompare(b.id) : a.from < b.from ? -1 : 1));
}

/** Οι υπερβάσεις ημερών μέσα στο `[windowFrom, windowTo)` — η οθόνη δεν χρειάζεται τις υπόλοιπες. */
export function stayDaysWithin(days: StayDayRules, windowFrom: string, windowTo: string): StayDayRules {
  const within: Record<string, StayDayRule> = {};
  for (const [date, rule] of Object.entries(days)) {
    if (date >= windowFrom && date < windowTo) within[date] = rule;
  }
  return within;
}
