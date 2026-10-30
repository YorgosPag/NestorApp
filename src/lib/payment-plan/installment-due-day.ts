/**
 * 🗓️ **Η ΛΗΞΗ ΔΟΣΗΣ ΕΙΝΑΙ ΗΜΕΡΑ, ΟΧΙ ΣΤΙΓΜΗ** — ο ένας κανόνας του πλάνου πληρωμών (ADR-234 §due-day).
 *
 * ## Η απόφαση και γιατί
 * Στα λογιστικά/ERP η λήξη είναι **ημερολογιακή ημέρα** (QuickBooks `DueDate`, Xero `DueDate`: σκέτη ημέρα), και στο
 * ελληνικό δίκαιο η προθεσμία **λήγει στο τέλος της τελευταίας ημέρας** (ΑΚ 241). Δόση «στις 5/11» είναι ληξιπρόθεσμη
 * από τις **6/11** ώρα Ελλάδας — όχι στις 02:00 της ίδιας 5/11 (μεσάνυχτα UTC), όπως έλεγε η σύγκριση στιγμών.
 * Αποθήκευση: `YYYY-MM-DD` (λεξικογραφική σύγκριση = χρονολογική, ταυτότητα στον αναγνώστη σε κάθε ζώνη).
 *
 * ## Παλιές εγγραφές
 * Ως τις 2026-10-29 το `Installment.dueDate` γραφόταν ως στιγμή (`toISOString()`): το wizard από **τοπική** ώρα
 * (01:30 Αθήνα 5/11 ⇒ `2026-11-04T23:30Z`), η φόρμα επεξεργασίας ως μεσάνυχτα UTC. Ο αναγνώστης εδώ τις διαβάζει
 * **ανεκτικά**: στιγμή ⇒ η ημέρα της **στην Αθήνα** (`operatorDayOf`) — και οι δύο παλιές μορφές δίνουν την ημέρα
 * που εννοούσε ο άνθρωπος. Κανένας άλλος κώδικας δεν διαβάζει το πεδίο ωμά.
 *
 * ## Τι ΔΕΝ είναι
 * Όχι μορφοποίηση (εμφάνιση: `formatDateKey`) και όχι κρίση στα σύνορα API (σχήμα: `installment-due-date` στο
 * `app/api/properties/_shared`, που κανονικοποιεί σε ημέρα πριν γράψει).
 *
 * @module lib/payment-plan/installment-due-day
 * @see docs/centralized-systems/reference/adrs/ADR-234-payment-plan-installment-tracking.md
 */

import { calendarDayOf, operatorDayOf, type CalendarDay } from '@/constants/platform-operator';
import { addMonthsToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';

/** Η ημέρα λήξης μιας αποθηκευμένης τιμής (`YYYY-MM-DD` ή παλιά στιγμή) — `null` αν δεν διαβάζεται. */
export function installmentDueDay(stored: unknown): CalendarDay | null {
  return typeof stored === 'string' ? operatorDayOf(stored) : null;
}

/** «Σήμερα» για τις κρίσεις λήξης — η ημέρα **Αθήνας**, όχι του διακομιστή (UTC) ή του browser. */
export function installmentToday(now: Date = new Date()): CalendarDay {
  return calendarDayOf(now);
}

/** Έχει περάσει **ολόκληρη** η ημέρα λήξης; (ΑΚ 241) — μη αναγνώσιμη λήξη ⇒ `false`, ποτέ «ληξιπρόθεσμη». */
export function isInstallmentPastDue(stored: unknown, today: CalendarDay): boolean {
  const due = installmentDueDay(stored);
  return due !== null && due < today;
}

/** Πόσες **ολόκληρες** ημέρες μετά τη λήξη είναι το `today` — `0` αν δεν έληξε ή δεν διαβάζεται (aging buckets). */
export function installmentDaysPastDue(stored: unknown, today: CalendarDay): number {
  const due = installmentDueDay(stored);
  const days = due === null ? null : daysBetweenDateKeys(due, today);
  return days !== null && days > 0 ? days : 0;
}

/**
 * Η λήξη της `monthsAhead`-οστής μηνιαίας δόσης από την ημέρα `start` — ψαλιδισμένη στο τέλος του μήνα
 * (`2027-01-31` + 1 ⇒ `2027-02-28`, ποτέ 3 Μαρτίου· `addMonthsToDateKey`, ADR-828 §1).
 */
export function monthlyDueDay(start: CalendarDay, monthsAhead: number): CalendarDay {
  return addMonthsToDateKey(start, monthsAhead) ?? start;
}

/** Ταξινόμηση κατά ημέρα λήξης (νωρίτερη πρώτα)· οι μη αναγνώσιμες στο τέλος — και για ανάμεικτες παλιές/νέες μορφές. */
export function compareInstallmentDueDays(a: unknown, b: unknown): number {
  const dayA = installmentDueDay(a);
  const dayB = installmentDueDay(b);
  if (dayA === dayB) return 0;
  if (dayA === null) return 1;
  if (dayB === null) return -1;
  return dayA < dayB ? -1 : 1;
}
