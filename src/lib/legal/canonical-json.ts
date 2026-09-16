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
 * @module lib/legal/canonical-json
 * @see ADR-861 §7
 */

const byKey = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0;

function sortDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sortDeep);
  if (node === null || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .sort(byKey)
      .map(([key, value]) => [key, sortDeep(value)]),
  );
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortDeep(value), null, 2).replace(/\r\n/g, '\n')}\n`;
}
