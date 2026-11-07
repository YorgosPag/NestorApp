/**
 * @fileoverview **ΟΥΡΑ ΤΗΣ ΔΙΩΝΥΜΙΚΗΣ ΣΕ ΛΟΓΑΡΙΘΜΟ** (SSoT, ADR-929 §6.9 #7) — η πιθανότητα του a-contrario.
 * @module lib/statistics/log-binomial-tail
 *
 * 🔑 **Γιατί λογάριθμος.** Το κριτήριο a-contrario (NFA = N_tests · P[X ≥ k], Desolneux–Moisan–Morel) ζει σε πιθανότητες
 * της τάξης 10⁻³⁰⁰ και κάτω: με 3.000 δείγματα και p = 0,05, μια σωστή καταγραφή δίνει P ≈ 10⁻²⁰⁰⁰, που σε `number`
 * είναι **0** — και το 0 δεν ξεχωρίζει ένα καλό από ένα εξαιρετικό ταίριασμα. Όλα γίνονται σε log-space.
 * 🔑 **Ακριβές άθροισμα, όχι προσέγγιση.** n ≤ μερικές χιλιάδες ⇒ O(n) όροι με log-sum-exp. Όχι Hoeffding/Chernoff
 * (φράγματα, όχι τιμές) και όχι κανονική προσέγγιση (λάθος ακριβώς στην ουρά που μας ενδιαφέρει).
 *
 * ⚠️ Καθαρή αριθμητική, χωρίς εισαγωγές· τρέχει σε Worker, διακομιστή και jest.
 */

/** Συντελεστές Lanczos (g = 7, n = 9) — σχετικό σφάλμα < 10⁻¹⁵ για x ≥ 1/2. */
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
] as const;

const HALF_LOG_TWO_PI = 0.5 * Math.log(2 * Math.PI);

/** ln Γ(x) για x > 0 (Lanczos· ανάκλαση Euler κάτω από 1/2). */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return HALF_LOG_TWO_PI + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln C(n, i). */
export function logBinomialCoefficient(n: number, i: number): number {
  return logGamma(n + 1) - logGamma(i + 1) - logGamma(n - i + 1);
}

/**
 * **log₁₀ P[X ≥ k]**, X ~ B(n, p). Όρια ορισμένα, ποτέ `NaN`: k ≤ 0 ⇒ 0 · k > n ⇒ −∞ · p ≤ 0 (με k > 0) ⇒ −∞ · p ≥ 1 ⇒ 0.
 */
export function log10BinomialTail(n: number, k: number, p: number): number {
  if (k <= 0) return 0;
  if (k > n) return Number.NEGATIVE_INFINITY;
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return 0;
  const lp = Math.log(p);
  const lq = Math.log1p(-p);
  const terms: number[] = [];
  let max = Number.NEGATIVE_INFINITY;
  for (let i = k; i <= n; i++) {
    const term = logBinomialCoefficient(n, i) + i * lp + (n - i) * lq;
    terms.push(term);
    if (term > max) max = term;
  }
  let sum = 0;
  for (const term of terms) sum += Math.exp(term - max);
  return Math.min(0, (max + Math.log(sum)) / Math.LN10);
}
