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

/**
 * Median absolute deviation (Tukey 1977) — `median(|vᵢ − med|)`. The outlier-RESISTANT
 * measure of spread: unlike a standard deviation, a handful of gross blunders cannot inflate
 * it and thereby hide inside their own variance. This is why every robust gate in the app
 * fences on `med + k·MAD` rather than on σ.
 *
 * `0` means the sample is degenerate (all values identical, or fewer than two) — callers
 * MUST treat that as "no usable spread" and fall back, never as "everything is an outlier".
 *
 * @param med pre-computed {@link median} of `values`; omit and it is derived. Pass it when
 *            you already have it — the callers that trim per-axis compute it once.
 */
export function mad(values: readonly number[], med?: number): number {
  if (values.length === 0) return 0;
  const centre = med ?? median(values);
  return median(values.map((v) => Math.abs(v - centre)));
}
