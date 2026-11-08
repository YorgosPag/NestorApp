/**
 * @fileoverview **ΟΥΡΑ ΤΗΣ ΔΙΩΝΥΜΙΚΗΣ ΣΕ ΛΟΓΑΡΙΘΜΟ** (SSoT, ADR-929 §6.9 #7) — η πιθανότητα του a-contrario.
 * @module lib/statistics/log-binomial-tail
 *
 * 🔑 **Γιατί λογάριθμος.** Το κριτήριο a-contrario (NFA = N_tests · P[X ≥ k], Desolneux–Moisan–Morel) ζει σε πιθανότητες
 * της τάξης 10⁻³⁰⁰ και κάτω: με 3.000 δείγματα και p = 0,05, μια σωστή καταγραφή δίνει P ≈ 10⁻²⁰⁰⁰, που σε `number`
 * είναι **0** — και το 0 δεν ξεχωρίζει ένα καλό από ένα εξαιρετικό ταίριασμα. Όλα γίνονται σε log-space.
 * 🔑 **Ακριβές άθροισμα, όχι προσέγγιση.** n ≤ μερικές χιλιάδες ⇒ O(n) όροι με log-sum-exp. Όχι Hoeffding/Chernoff
 * (φράγματα, όχι τιμές) και όχι κανονική προσέγγιση (λάθος ακριβώς στην ουρά που μας ενδιαφέρει).
 * 🔑 **Και με άνισα p** (§6.9 #9): {@link log10PoissonBinomialTail}, όταν κάθε δοκιμή έχει δικό της p (εμπειρικό ανά τμήμα).
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

/** ln(eᵃ + eᵇ) χωρίς υπερχείλιση· −∞ είναι το ουδέτερο στοιχείο. */
function logAddExp(a: number, b: number): number {
  if (a === Number.NEGATIVE_INFINITY) return b;
  if (b === Number.NEGATIVE_INFINITY) return a;
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/**
 * **log₁₀ P[X ≥ k]**, X = Σ Bernoulli(pᵢ) ανεξάρτητες με **διαφορετικά** pᵢ (Poisson-binomial, ADR-929 §6.9 #9).
 * 🔑 Ακριβές, με δυναμικό προγραμματισμό O(n·k) σε log-space: μετά από κάθε δοκιμή κρατά ln P[ακριβώς j επιτυχίες] για
 * j < k και **μία** συσσωρευμένη θέση «≥ k». Όχι B(n, p_max) (φράγμα, συχνά άχρηστα χαλαρό) ούτε κανονική προσέγγιση.
 * Όρια ορισμένα όπως στο {@link log10BinomialTail}: k ≤ 0 ⇒ 0 · k > n ⇒ −∞. Τα pᵢ κόβονται στο [0, 1].
 */
export function log10PoissonBinomialTail(ps: readonly number[], k: number): number {
  if (k <= 0) return 0;
  if (k > ps.length) return Number.NEGATIVE_INFINITY;
  const NEG = Number.NEGATIVE_INFINITY;
  // cur[j] = ln P[j επιτυχίες] για j < k· cur[k] = ln P[≥ k].
  let cur = new Array<number>(k + 1).fill(NEG);
  cur[0] = 0;
  for (const raw of ps) {
    const p = Math.min(1, Math.max(0, raw));
    const lp = p > 0 ? Math.log(p) : NEG;
    const lq = p < 1 ? Math.log1p(-p) : NEG;
    const next = new Array<number>(k + 1).fill(NEG);
    for (let j = 0; j <= k; j++) {
      if (cur[j] === NEG) continue;
      const up = Math.min(k, j + 1);
      next[up] = logAddExp(next[up], cur[j] + (j === k ? 0 : lp));
      if (j < k) next[j] = logAddExp(next[j], cur[j] + lq);
    }
    cur = next;
  }
  return Math.min(0, cur[k] / Math.LN10);
}
