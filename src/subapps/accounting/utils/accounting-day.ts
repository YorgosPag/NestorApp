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

/** Η ημερολογιακή ημέρα της Αθήνας τη στιγμή `now`. */
export function accountingToday(now: Date = new Date()): string {
  return athensClockAt(now).dateKey;
}
