/**
 * @fileoverview **Εργάσιμη ημέρα στο ελληνικό ημερολόγιο** — όχι Σάββατο, όχι Κυριακή, όχι επίσημη αργία
 *   (σταθερές και κινητές του Πάσχα, μετάθεση της 1ης Μαΐου). ADR-928 §5.4.1 «κανόνας αργιών» · §5.17.
 * @related lib/calendar/greek-public-holidays.ts (ο ΕΝΑΣ κριτής αργίας) · lib/calendar/date-key.ts (αριθμητική ημερών)
 * @module lib/calendar/business-days
 *
 * 🔑 Γενικό, όχι της υπεργολαβίας: το χρειάζονται πληρωμές, προθεσμίες, λήξεις. Καμία δεύτερη λίστα αργιών εδώ.
 * 🔑 Κλειδί ημέρας `YYYY-MM-DD` **στην ώρα Ελλάδας** (ίδια σύμβαση με το `greekPublicHolidayOn`).
 */

import type { IsoWeekday } from './weekly-hours';
import { addDaysToDateKey, isoWeekdayOfDateKey } from './date-key';
import { greekPublicHolidayOn, type GreekPublicHolidayId } from './greek-public-holidays';

/**
 * **Γιατί** μια ημέρα δεν είναι εργάσιμη — ώστε η οθόνη να το πει με όνομα («λήγει Κυριακή» · «λήγει Καθαρά Δευτέρα»),
 * όχι μόνο ναι/όχι. Η αργία προηγείται: αργία που πέφτει Κυριακή λέγεται με το όνομά της.
 */
export type NonBusinessDayReason =
  | { readonly kind: 'holiday'; readonly holiday: GreekPublicHolidayId }
  | { readonly kind: 'weekend'; readonly weekday: Extract<IsoWeekday, 6 | 7> };

/** `null` ⇒ εργάσιμη **ή** άκυρο κλειδί (ο καλών που χρειάζεται τη διάκριση ρωτά το {@link isBusinessDay}). */
export function nonBusinessDayReason(dateKey: string): NonBusinessDayReason | null {
  const weekday = isoWeekdayOfDateKey(dateKey);
  if (weekday === null) return null;
  const holiday = greekPublicHolidayOn(dateKey);
  if (holiday !== null) return { kind: 'holiday', holiday };
  return weekday === 6 || weekday === 7 ? { kind: 'weekend', weekday } : null;
}

/** Πού πάει μια ημερομηνία που πέφτει σε μη εργάσιμη (ίδιο λεξιλόγιο με το `HolidayShift` του σχεδίου πληρωμών). */
export type BusinessDayShift = 'previous_business_day' | 'next_business_day' | 'none';

/**
 * Το μακρύτερο συνεχόμενο διάστημα μη εργάσιμων είναι 4 ημέρες (Μ. Παρασκευή → Δευτέρα του Πάσχα) — το όριο είναι
 * φρένο ασφαλείας απέναντι σε άκυρη είσοδο, όχι κανόνας ημερολογίου.
 */
const MAX_SHIFT_DAYS = 14;

/** Εργάσιμη; `false` και για άκυρο κλειδί (fail-closed: άγνωστη ημέρα δεν είναι εργάσιμη). */
export function isBusinessDay(dateKey: string): boolean {
  return isoWeekdayOfDateKey(dateKey) !== null && nonBusinessDayReason(dateKey) === null;
}

/** Φρένο ασφαλείας του {@link addBusinessDays} — όχι κανόνας: καμία προθεσμία της εφαρμογής δεν ζητά περισσότερες. */
const MAX_BUSINESS_DAYS = 366;

/**
 * **Η Ν-οστή εργάσιμη ΜΕΤΑ από την ημέρα** — η ίδια η ημέρα δεν μετρά («παράδοση σε 5 εργάσιμες» από Δευτέρα ⇒ την
 * επόμενη Δευτέρα), σαββατοκύριακα και επίσημες αργίες δεν μετρούν (ADR-915 §45 Φ2). `n = 0` ⇒ η ίδια ημέρα.
 * `null` για άκυρο κλειδί, αρνητικό ή μη ακέραιο `n`, ή `n` πάνω από το φρένο.
 */
export function addBusinessDays(dateKey: string, n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > MAX_BUSINESS_DAYS || isoWeekdayOfDateKey(dateKey) === null) return null;
  let current: string | null = dateKey;
  for (let counted = 0; current !== null && counted < n;) {
    current = addDaysToDateKey(current, 1);
    if (current !== null && isBusinessDay(current)) counted += 1;
  }
  return current;
}

/**
 * Η ημερομηνία μετά τον κανόνα αργιών: εργάσιμη ⇒ ίδια· αλλιώς η προηγούμενη/επόμενη εργάσιμη. `'none'` ⇒ ίδια.
 * `null` για άκυρο κλειδί.
 */
export function shiftToBusinessDay(dateKey: string, shift: BusinessDayShift): string | null {
  if (isoWeekdayOfDateKey(dateKey) === null) return null;
  if (shift === 'none') return dateKey;
  const step = shift === 'previous_business_day' ? -1 : 1;
  let candidate: string | null = dateKey;
  for (let moved = 0; candidate !== null && moved <= MAX_SHIFT_DAYS; moved += 1) {
    if (isBusinessDay(candidate)) return candidate;
    candidate = addDaysToDateKey(candidate, step);
  }
  return null;
}
