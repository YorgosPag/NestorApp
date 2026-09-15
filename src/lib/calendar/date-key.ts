/**
 * @fileoverview **ΚΛΕΙΔΙΑ ΗΜΕΡΟΛΟΓΙΑΚΗΣ ΗΜΕΡΑΣ `YYYY-MM-DD`** — αριθμητική ημερών χωρίς ζώνη ώρας (ADR-841 §7 Α21.21).
 * @related lib/date-local.ts (`utcDateOf` · `localDateOf`) · lib/calendar/hours-timeline.ts · lib/calendar/special-hours.ts
 * @module lib/calendar/date-key
 *
 * 🔑 **Μια ημερολογιακή ημέρα δεν έχει ζώνη ώρας**: «25 Δεκεμβρίου» είναι η ίδια μέρα για όλους. Η αριθμητική
 * γίνεται σε **μεσάνυχτα UTC**, όπου κάθε μέρα έχει ακριβώς 24 ώρες — ποτέ σε τοπική `Date`, όπου η αλλαγή ώρας
 * φτιάχνει μέρα 23 ή 25 ωρών και το «+1 ημέρα» πέφτει στην ίδια ημερομηνία. **Ποια** μέρα είναι τώρα το
 * αποφασίζει ο καλών (`athensClockAt`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { localDateOf, MS_PER_DAY, utcDateOf } from '@/lib/date-local';
import type { IsoWeekday } from '@/lib/calendar/weekly-hours';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Μεσάνυχτα UTC της ημέρας — `null` για κακογραμμένη **ή ανύπαρκτη** ημέρα (30 Φεβρουαρίου). */
function utcMidnightOf(key: string): number | null {
  const match = DATE_KEY.exec(key);
  if (match === null) return null;
  const midnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Το `Date.UTC` «διορθώνει» σιωπηλά το 2026-02-30 σε 2026-03-02 — η σύγκριση το πιάνει.
  return utcDateOf(midnight) === key ? midnight : null;
}

/** Υπαρκτή ημερολογιακή ημέρα `YYYY-MM-DD`. */
export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && utcMidnightOf(value) !== null;
}

/** Η ημέρα `days` μετά (αρνητικό = πριν) — `null` για άκυρο κλειδί. */
export function addDaysToDateKey(key: string, days: number): string | null {
  const midnight = utcMidnightOf(key);
  return midnight === null ? null : utcDateOf(midnight + days * MS_PER_DAY);
}

/** Πόσες ημέρες από το `from` ως το `to` (αρνητικό = το `to` είναι πριν) — `null` αν κάποιο είναι άκυρο. */
export function daysBetweenDateKeys(from: string, to: string): number | null {
  const start = utcMidnightOf(from);
  const end = utcMidnightOf(to);
  return start === null || end === null ? null : Math.round((end - start) / MS_PER_DAY);
}

/** ISO ημέρα της εβδομάδας (1 = Δευτέρα … 7 = Κυριακή). */
export function isoWeekdayOfDateKey(key: string): IsoWeekday | null {
  const midnight = utcMidnightOf(key);
  if (midnight === null) return null;
  const day = new Date(midnight).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** Κλειδί → τοπική `Date` της **ίδιας** ημέρας, για επιλογέα ημερομηνίας. Αντίστροφο του `localDateOf`. */
export function calendarDateOfDateKey(key: string): Date | null {
  const match = DATE_KEY.exec(key);
  if (match === null || !isDateKey(key)) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localDateOf(date) === key ? date : null;
}
