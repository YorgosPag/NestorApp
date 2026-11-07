/**
 * @fileoverview Λογιστικές χρήσεις — το ΠΑΡΑΘΥΡΟ αυτόματου ανοίγματος (SSoT, καθαρό, χωρίς I/O)
 * @description Ποιες χρήσεις επιτρέπεται να ανοίξει το ΣΥΣΤΗΜΑ χωρίς ρητή διοικητική πράξη (ADR-ACC-010 §2.1.1 Φ9):
 *   `[max(τρέχον − 1, έτος έναρξης εργασιών), τρέχον + 1]`, με «τρέχον» = η χρήση της ημέρας ΑΘΗΝΑΣ.
 *
 *   - `τρέχον − 1`: τον Ιανουάριο–Φεβρουάριο καταχωρούνται κανονικά παραστατικά Δεκεμβρίου (κλείσιμο χρήσης)·
 *   - `τρέχον + 1`: τιμολόγιο / εγγραφή με ημερομηνία του επόμενου έτους στα τέλη Δεκεμβρίου·
 *   - έτος έναρξης: χρήση ΠΡΙΝ την έναρξη εργασιών δεν υπάρχει — ποτέ αυτόματα.
 *   Εκτός παραθύρου (π.χ. τυπογραφικό `2062`, ή μεταφορά ιστορικού 2019) ⇒ ΜΟΝΟ ρητή πράξη διαχειριστή (`manual`).
 *   Κλεισμένη / κλειδωμένη χρήση ΥΠΑΡΧΕΙ ήδη ⇒ το παράθυρο δεν την αγγίζει ποτέ.
 *
 *   Πρότυπο: Xero / QuickBooks — οι περίοδοι «απλώς υπάρχουν» για τον χρήστη· SAP OB52 — έλεγχος από τον διαχειριστή.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 9)
 */

import type { BusinessStart } from '../types/company';

/** Το κλειστό διάστημα χρήσεων που ανοίγει το σύστημα· `null` ⇒ καμία (έναρξη μετά το `τρέχον + 1`). */
export interface AutoOpenableFiscalYears {
  readonly from: number;
  readonly to: number;
}

/** Η χρήση (ημερολογιακό έτος) μιας λογιστικής ημέρας `YYYY-MM-DD`. */
export function fiscalYearOfDay(day: string): number {
  return Number(day.slice(0, 4));
}

/** Το παράθυρο για τη σημερινή ημέρα (Αθήνας) και την έναρξη εργασιών της επιχείρησης. */
export function autoOpenableFiscalYears(
  today: string,
  businessStart: Pick<BusinessStart, 'date'> | null
): AutoOpenableFiscalYears | null {
  const current = fiscalYearOfDay(today);
  const startYear = businessStart === null ? null : fiscalYearOfDay(businessStart.date);
  const from = startYear === null || Number.isNaN(startYear) ? current - 1 : Math.max(current - 1, startYear);
  const to = current + 1;
  return from > to ? null : { from, to };
}

/** Ανοίγει το σύστημα μόνο του τη χρήση `fiscalYear`; */
export function isAutoOpenableFiscalYear(
  fiscalYear: number,
  today: string,
  businessStart: Pick<BusinessStart, 'date'> | null
): boolean {
  const window = autoOpenableFiscalYears(today, businessStart);
  return window !== null && fiscalYear >= window.from && fiscalYear <= window.to;
}
