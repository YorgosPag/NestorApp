// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/sort-keys-deep.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:f7d6a87d483fac7262dfcbc6fcab9f64b33ac18c57796782f55dabc274fb1713

/**
 * **Ταξινόμησε τα κλειδιά αναδρομικά** — το ένα πρωτογενές πίσω από κάθε «ίδιο αντικείμενο ⇒ ίδια
 * συμβολοσειρά» (ADR-919 §9 · N.0.2).
 *
 * Ζούσε δύο φορές: `sortDeep` στο `lib/legal/canonical-json.ts` (αποτυπώματα νομικών εκδόσεων) και
 * `sortKeys` στο `lib/audit/audit-diff.ts` (σύγκριση audit). Ίδια αναδρομή, ίδια σειρά — δύο σημεία
 * που μπορούσαν να μάθουν διαφορετική απάντηση. Ουδέτερο αρχείο επίτηδες: δεν ανήκει ούτε στο
 * `legal` ούτε στο `audit`.
 *
 * ⚠️ **Η σειρά είναι μορφή, όχι λεπτομέρεια**: μονάδες UTF-16 (ό,τι κάνει το `Array.prototype.sort`
 * χωρίς συγκριτή). Το `canonicalJson` είναι **παγωμένη** μορφή (ADR-861 §7) — αλλαγή εδώ αλλάζει
 * κάθε αποτύπωμα· η άγκυρα bytes-ισότητας είναι το `legal-document-versions.test.ts`.
 *
 * 🔑 `Object.fromEntries`, όχι ανάθεση σε `{}`: κλειδί `__proto__` γίνεται **κανονικό πεδίο** αντί
 * να αλλάξει σιωπηλά το prototype του αποτελέσματος.
 *
 * Πίνακες: η σειρά των στοιχείων μένει· ταξινομούνται μόνο τα κλειδιά μέσα τους.
 *
 * @module lib/sort-keys-deep
 */

const byKey = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0;

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(byKey)
      .map(([key, nested]) => [key, sortKeysDeep(nested)]),
  );
}
