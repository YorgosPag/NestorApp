/**
 * Στατιστικά helpers (pure SSoT). Μικρές, ανθεκτικές συναρτήσεις που χρησιμοποιούνται
 * σε πολλά domains (perf baselines, geometry outlier-filtering) — ΜΙΑ πηγή αλήθειας
 * αντί για τοπικά αντίγραφα.
 */

/**
 * Διάμεσος μιας λίστας αριθμών. Ταξινομεί εσωτερικά (δέχεται μη-ταξινομημένη είσοδο),
 * άρα είναι ασφαλής για κάθε caller. Κενή λίστα → 0.
 */
export function median(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
