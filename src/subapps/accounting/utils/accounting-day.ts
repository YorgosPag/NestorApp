/**
 * @fileoverview «Σήμερα» της λογιστικής — SSoT
 * @description Η ημέρα αναφοράς (`YYYY-MM-DD`) για υπολογισμούς με ημερομηνία: ηλικίωση απαιτήσεων, αναγωγή φόρου
 *   σε έτος (IAS 34). Είναι η ημέρα **Αθήνας**, όχι του διακομιστή: ο Netcup τρέχει σε UTC, άρα από τις 00:00 ως
 *   τις 02:00/03:00 (ώρα Ελλάδας) το `new Date()` / `todayLocalDate()` έλεγε «χθες» — ένα τιμολόγιο που έληγε
 *   χθες δεν ήταν ακόμη ληξιπρόθεσμο.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 3) · `lib/calendar/weekly-hours.ts` (`athensClockAt`)
 */

import { athensClockAt } from '@/lib/calendar/weekly-hours';
import { hasCalendarDayShape, isCalendarDay } from '@/lib/date/calendar-day';

/** Η ημερολογιακή ημέρα της Αθήνας τη στιγμή `now`. */
export function accountingToday(now: Date = new Date()): string {
  return athensClockAt(now).dateKey;
}

/**
 * Η λογιστική ημέρα (`YYYY-MM-DD`) μιας ημερομηνίας εγγραφής — ή `null` αν δεν είναι πραγματική ημερομηνία.
 * Σκέτη ημέρα ⇒ αυτούσια (ΚΑΜΙΑ μετατροπή ζώνης: το `new Date('2026-12-01').getMonth()` δίνει Νοέμβριο σε κάθε
 * ζώνη δυτικά του UTC)· στιγμή με ώρα ⇒ η ημέρα της ΑΘΗΝΑΣ (`…T23:30:00Z` = 1η του επόμενου μήνα στην Ελλάδα).
 * Το `2026-02-30` / `2026-13-01` απορρίπτεται — αλλιώς ο «μήνας 13» θα έπεφτε στην περίοδο κλεισίματος.
 */
export function accountingDayOf(value: string): string | null {
  if (hasCalendarDayShape(value)) return isCalendarDay(value) ? value : null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : accountingToday(instant);
}
