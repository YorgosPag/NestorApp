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
      /** Ιδιωτική σημείωση του οικοδεσπότη για χειροκίνητη κράτηση· `null` για λογαριασμό. */
      readonly guestLabel: string | null;
      readonly channel: StayBookingChannel;
      readonly lifecycle: StayBookingLifecycle;
      /** Πιάνει νύχτες; — από τη **μία** πηγή (`stayEntryOccupies`), ποτέ ξαναγραμμένο στην οθόνη. */
      readonly occupies: boolean;
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
    }
  | { readonly kind: 'unreadable' };

export function stayCalendarEntryViewOf(entry: StayCalendarEntry): StayCalendarEntryView {
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
    guestLabel: booking.holder.kind === 'offline' ? booking.holder.label : null,
    channel: booking.channel,
    lifecycle: booking.lifecycle,
    occupies: stayEntryOccupies(entry),
  };
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
