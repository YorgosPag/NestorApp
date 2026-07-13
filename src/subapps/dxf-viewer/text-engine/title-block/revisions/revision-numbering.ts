/**
 * ADR-651 Φάση Η — **ντετερμινιστική αρίθμηση αναθεωρήσεων** (Απόφαση #9: «το σύστημα
 * κρατά ΜΟΝΟ ΤΟΥ τον αριθμό — 1η / 2η / 3η»).
 *
 * Καθαρές συναρτήσεις, ίδιο μοτίβο με το `sheet-numbering.ts` της Φάσης Ζ: η **θέση** στην
 * ιστορία ⇒ ο **αριθμός**. Καμία χειρόγραφη αρίθμηση, καμία δεύτερη πηγή αλήθειας.
 *
 * @see ./revision.types.ts
 * @see ../sheet-numbering.ts — το αδελφό SSoT (αρίθμηση φύλλων)
 */

import type { TitleBlockLocale } from '../title-block-presets';

/** Ο αριθμός της επόμενης αναθεώρησης: max(υπάρχοντες) + 1. Κενή ιστορία ⇒ 1. */
export function nextRevisionNumber(existing: readonly { readonly number: number }[]): number {
  return existing.reduce((max, rev) => Math.max(max, rev.number), 0) + 1;
}

/**
 * Ο αριθμός όπως **γράφεται στην πινακίδα** (`{{revision.number}}`): ελληνικά «1η / 2η / 3η»
 * (τακτικό θηλυκό — «1η Αναθεώρηση», όπως το ζήτησε ο Giorgio), αγγλικά «1 / 2 / 3»
 * (στήλη «No.» του πίνακα — Απόφαση #8: ελληνικά default, κουμπί → αγγλικά).
 */
export function formatRevisionNumber(number: number, locale: TitleBlockLocale): string {
  return locale === 'en' ? String(number) : `${number}η`;
}
