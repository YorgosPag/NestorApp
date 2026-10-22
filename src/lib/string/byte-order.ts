/**
 * @fileoverview **Η ΣΕΙΡΑ ΚΑΤΑ BYTES** — η μία σύγκριση «λεξικογραφικά, byte προς byte» (ADR-916 §5.11 · ADR-918).
 * @module lib/string/byte-order
 *
 * 🔑 **Γιατί όχι `.sort()` ή `localeCompare`**: το `.sort()` της JS ταξινομεί κατά **μονάδες UTF-16**, το `localeCompare`
 *    κατά **γλώσσα**. Κανένα από τα δύο δεν είναι η σειρά που ακολουθεί ένας τρίτος με `sort` (LC_ALL=C), `Buffer.compare`
 *    ή DER `SET OF`. Η σειρά UTF-16 ταυτίζεται με τη σειρά bytes **μόνο** στο ASCII· χαρακτήρας εκτός BMP (π.χ. emoji,
 *    σε ζεύγος υποκατάστασης `D800–DFFF`) ταξινομείται **πριν** από `E000–FFFF` στο UTF-16 αλλά **μετά** σε UTF-8.
 * 🔑 Η σειρά bytes UTF-8 = η σειρά **κωδικών σημείων** Unicode (ιδιότητα σχεδίασης του UTF-8, RFC 3629 §1).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ισομορφικές (browser · Node), κανένα `Buffer`.
 */

const UTF8 = new TextEncoder();

/** **Λεξικογραφική σύγκριση bytes** — αρνητικό / 0 / θετικό, πρόθεμα πριν από το μακρύτερο (σημασιολογία `Buffer.compare`). */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

/** **Σύγκριση κειμένων κατά τα bytes UTF-8 τους** — η σειρά που βλέπει κάθε τρίτος εκτός JS. */
export function compareUtf8(a: string, b: string): number {
  return compareBytes(UTF8.encode(a), UTF8.encode(b));
}
