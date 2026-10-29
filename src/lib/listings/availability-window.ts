/**
 * @fileoverview **ΤΟ ΔΙΑΣΤΗΜΑ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** — από «Γ' τρίμηνο 2027» σε ημερομηνίες, και πίσω σε υπόσχεση.
 * @related ADR-777 §8.99.4 (Δ2) · ADR-919 · `types/listing-availability.ts`
 * @module lib/listings/availability-window
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΠΟΘΗΚΕΥΕΤΑΙ ΔΙΑΣΤΗΜΑ, ΚΡΙΝΕΤΑΙ ΤΟ ΤΕΛΟΣ ΤΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η εταιρεία δηλώνει «Γ' τρίμηνο 2027». Αποθηκεύεται το **διάστημα** 2027-07-01…2027-09-30
 * μαζί με την ακρίβεια, ώστε η οθόνη να γράφει ξανά «Γ' τρίμηνο» και όχι ψεύτικη ακρίβεια
 * ημέρας. Το ταίριασμα όμως ρωτά «**πότε είναι σίγουρο** ότι θα είναι έτοιμο;», και η μόνη
 * τίμια απάντηση είναι το **τέλος** του διαστήματος. Το idealista και το ImmoScout24 δείχνουν
 * το τρίμηνο μόνο για προβολή· εδώ το ίδιο γεγονός κρίνει και τη ζήτηση, χωρίς να υπόσχεται
 * περισσότερα από όσα δηλώθηκαν.
 *
 * Η κρίση με το τέλος ζει **σε ένα σημείο**, στο `timingBlockers` (`lib/demand/demand-match-axes.ts`)·
 * κάθε άλλος που ρωτά «ταιριάζει τότε;» (π.χ. η ειδοποίηση μετάθεσης) ρωτά τη μηχανή.
 *
 * Όλα σε UTC, χωρίς ώρα: ίδιος κανόνας με το `lib/date/calendar-arithmetic.ts`.
 */

import { daysInMonth } from '@/lib/date/calendar-arithmetic';
// «Υπάρχει η ημέρα;» — ο κριτής γεννήθηκε εδώ και μετακόμισε στο SSoT (η 2027-02-30 απορρίπτεται, δεν κυλά στον Μάρτιο).
import { formatCalendarDay, parseCalendarDay } from '@/lib/date/calendar-day';
import type {
  AvailabilityPrecision,
  AvailabilityWindow,
  ListingAvailability,
} from '@/types/listing-availability';

/** Οι μήνες (1-based) που καλύπτει η ακρίβεια γύρω από τον μήνα της άγκυρας. */
function monthSpan(precision: AvailabilityPrecision, month: number): readonly [number, number] {
  if (precision === 'quarter') {
    const first = Math.floor((month - 1) / 3) * 3 + 1;
    return [first, first + 2];
  }
  return [month, month];
}

/**
 * Το διάστημα που αντιστοιχεί σε μια δήλωση: `anchorIso` είναι **οποιαδήποτε** ημέρα μέσα
 * στο τρίμηνο / μήνα / την ίδια την ημέρα. `null` αν η άγκυρα δεν είναι πραγματική ημέρα.
 */
export function availabilityWindowOf(
  precision: AvailabilityPrecision,
  anchorIso: string,
): AvailabilityWindow | null {
  const anchor = parseCalendarDay(anchorIso);
  if (anchor === null) return null;
  if (precision === 'day') {
    const day = formatCalendarDay(anchor.year, anchor.month, anchor.day);
    return { start: day, end: day };
  }
  const [firstMonth, lastMonth] = monthSpan(precision, anchor.month);
  return {
    start: formatCalendarDay(anchor.year, firstMonth, 1),
    end: formatCalendarDay(anchor.year, lastMonth, daysInMonth(anchor.year, lastMonth)),
  };
}

/**
 * **Ο μόνος κατασκευαστής** του `scheduled`: το διάστημα βγαίνει από την ακρίβεια, ποτέ με
 * το χέρι. Άκυρη άγκυρα ⇒ `unknown`, όχι εικασία.
 */
export function scheduledAvailability(
  precision: AvailabilityPrecision,
  anchorIso: string,
): ListingAvailability {
  const window = availabilityWindowOf(precision, anchorIso);
  return window === null ? { kind: 'unknown' } : { kind: 'scheduled', precision, window };
}
