/**
 * Η **κανονική** σειριοποίηση JSON — ίδια bytes με τον γεννήτορα εκδόσεων
 * (`scripts/lib/i18n-shell-slice/slice-build.js` `stableStringify`).
 *
 * Υπάρχει για **έναν** λόγο: ο αναγνώστης μιας παγωμένης έκδοσης νομικού κειμένου κατεβάζει
 * **τα ίδια bytes** που υπογράφει το αποτύπωμα του μητρώου, χωρίς δεύτερο αντίγραφο στο `public/`.
 * Η ισότητα με τα αρχεία στον δίσκο είναι **άγκυρα** (`legal-document-versions.test.ts`), όχι υπόθεση.
 *
 * ⚠️ Ταξινομημένα κλειδιά (σειρά μονάδων UTF-16, όπως το `Array.prototype.sort`) · εσοχή 2 · LF ·
 * τελικό newline. Μην «βελτιώσεις» τη μορφή: αλλάζει κάθε αποτύπωμα και σπάει την
 * αποδειξιμότητα κάθε δημοσιευμένης έκδοσης.
 *
 * Η ταξινόμηση κλειδιών είναι το κοινό πρωτογενές `sortKeysDeep` (ADR-919 §9 — πριν ζούσε εδώ
 * ως ιδιωτικό `sortDeep`, δίδυμο του `sortKeys` του audit).
 *
 * @module lib/legal/canonical-json
 * @see ADR-861 §7
 */

import { sortKeysDeep } from '@/lib/sort-keys-deep';

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2).replace(/\r\n/g, '\n')}\n`;
}
