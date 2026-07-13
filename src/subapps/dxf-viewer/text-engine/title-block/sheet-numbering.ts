/**
 * ADR-651 Φάση Ζ — αυτόματη αρίθμηση φύλλων ενός σετ (Α-1, Α-2, Α-3…).
 *
 * Καθαρές, ντετερμινιστικές συναρτήσεις (πρακτική AutoCAD Sheet Set Manager /
 * ArchiCAD Subset auto-numbering): η **θέση** ενός φύλλου στο σετ ⇒ ο **αριθμός**
 * του. Καμία χειρόγραφη αρίθμηση, καμία δεύτερη πηγή αλήθειας — ο αριθμός περνά
 * στο scope ως `drawing.sheetNumber` override (ίδιο μοτίβο με το `scaleName` της
 * Φάσης Ε) και τυπώνεται στην ίδια πινακίδα σε κάθε φύλλο.
 *
 * @see ./sheet-set.ts — ο καταναλωτής (χτίζει το σετ από τα levels)
 * @see ./active-title-block.ts — `TitleBlockScopeOverrides.sheetNumber`
 */

import type { TitleBlockLocale } from './title-block-presets';

/**
 * Το πρόθεμα αρίθμησης ανά γλώσσα προτύπου (Απόφαση #8: ελληνικά default, κουμπί →
 * αγγλικά). Ελληνικό «Α» = Αρχιτεκτονικά (ΤΕΕ πρακτική)· λατινικό «A» για ξένα έργα.
 */
export function sheetNumberPrefixForLocale(locale: TitleBlockLocale): string {
  return locale === 'en' ? 'A' : 'Α'; // U+0041 Latin A vs U+0391 Greek Alpha
}

/**
 * Ο αριθμός φύλλου για τη θέση `index` (0-based) στο σετ: `${prefix}-${index + 1}`.
 * π.χ. `autoSheetNumber(0, 'Α')` → «Α-1». Καθαρή συνάρτηση.
 */
export function autoSheetNumber(index: number, prefix: string): string {
  return `${prefix}-${index + 1}`;
}
