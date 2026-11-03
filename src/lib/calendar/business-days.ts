/**
 * @fileoverview **Εργάσιμη ημέρα στο ελληνικό ημερολόγιο** — όχι Σάββατο, όχι Κυριακή, όχι επίσημη αργία
 *   (σταθερές και κινητές του Πάσχα, μετάθεση της 1ης Μαΐου). ADR-928 §5.4.1 «κανόνας αργιών» · §5.17.
 * @related lib/calendar/greek-public-holidays.ts (ο ΕΝΑΣ κριτής αργίας) · lib/calendar/date-key.ts (αριθμητική ημερών)
 * @module lib/calendar/business-days
 *
 * 🔑 Γενικό, όχι της υπεργολαβίας: το χρειάζονται πληρωμές, προθεσμίες, λήξεις. Καμία δεύτερη λίστα αργιών εδώ.
 * 🔑 Κλειδί ημέρας `YYYY-MM-DD` **στην ώρα Ελλάδας** (ίδια σύμβαση με το `greekPublicHolidayOn`).
 */

import { addDaysToDateKey, isoWeekdayOfDateKey } from './date-key';
import { greekPublicHolidayOn } from './greek-public-holidays';

/** Πού πάει μια ημερομηνία που πέφτει σε μη εργάσιμη (ίδιο λεξιλόγιο με το `HolidayShift` του σχεδίου πληρωμών). */
export type BusinessDayShift = 'previous_business_day' | 'next_business_day' | 'none';

/**
 * Το μακρύτερο συνεχόμενο διάστημα μη εργάσιμων είναι 4 ημέρες (Μ. Παρασκευή → Δευτέρα του Πάσχα) — το όριο είναι
 * φρένο ασφαλείας απέναντι σε άκυρη είσοδο, όχι κανόνας ημερολογίου.
 */
const MAX_SHIFT_DAYS = 14;

/** Εργάσιμη; `false` και για άκυρο κλειδί (fail-closed: άγνωστη ημέρα δεν είναι εργάσιμη). */
export function isBusinessDay(dateKey: string): boolean {
  const weekday = isoWeekdayOfDateKey(dateKey);
  if (weekday === null || weekday >= 6) return false;
  return greekPublicHolidayOn(dateKey) === null;
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
