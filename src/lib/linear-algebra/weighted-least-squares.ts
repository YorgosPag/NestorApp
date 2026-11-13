/**
 * @fileoverview **ΣΤΑΘΜΙΣΜΕΝΑ ΕΛΑΧΙΣΤΑ ΤΕΤΡΑΓΩΝΑ ΜΕ ΣΤΑΤΙΣΤΙΚΗ ΑΞΙΟΠΙΣΤΙΑΣ** (SSoT) — το μοντέλο Gauss–Markov της γεωδαισίας:
 * `l + v = A·x`, βάρη `P = diag(1/σ²)`.
 * @module lib/linear-algebra/weighted-least-squares
 * @related `./sparse-ordering.ts` + `./sparse-ldlt.ts` (η επίλυση των κανονικών εξισώσεων) · `./robust-adjustment.ts` (data snooping)
 *
 * 🔑 **Δεν αρκεί η λύση.** Για να πει κανείς «αυτή η μέτρηση είναι λάθος» χρειάζεται, για **κάθε** παρατήρηση:
 * - το **υπόλοιπο** `vᵢ`·
 * - τον **αριθμό πλεονασμού** `rᵢ = pᵢ·(Q_vv)ᵢᵢ ∈ [0, 1]`: πόσο ελέγχεται από τις υπόλοιπες (0 ⇒ καθόλου: ένα λάθος της
 *   απορροφάται χωρίς ίχνος — Baarda, «εσωτερική αξιοπιστία»)·
 * - το **τυποποιημένο υπόλοιπο** `wᵢ = vᵢ / (σ₀·√(Q_vv)ᵢᵢ)` με το a priori `σ₀ = 1` (τεστ Baarda).
 * Το `Q_vv = Q_ll − A·N⁻¹·Aᵀ` θέλει **μόνο** τα στοιχεία του `N⁻¹` στα ζεύγη αγνώστων κάθε παρατήρησης ⇒ αραιή LDLᵀ +
 * επιλεγμένος αντίστροφος (Takahashi), όχι ολόκληρος ο `N⁻¹` με `n` επιλύσεις (ADR-929 §6.16 #8: 1 380 ms μετρημένα).
 * 🔑 **Αραιές γραμμές.** Κάθε παρατήρηση αγγίζει λίγους αγνώστους (`terms`), άρα και το `aᵀ·Q·a` κοστίζει O(όροι²).
 *
 * 📐 Πηγές: Baarda (1968) «A testing procedure for use in geodetic networks»· Koch, «Parameter Estimation and Hypothesis
 *   Testing in Linear Models»· Wilson & Hilferty (1931) για την προσέγγιση του ποσοστημορίου χ².
 */

import { analyzeSparsePattern, type SparseAnalysis } from './sparse-ordering';
import { factorSparse, selectedInverse, solveSparse, SparseSymmetricMatrix, UNDEFINED_COFACTOR, type Cofactor } from './sparse-ldlt';

export type { Cofactor } from './sparse-ldlt';

export interface ObservationTerm {
  readonly index: number;
  readonly coefficient: number;
}

/** Μία γραμμική παρατήρηση `Σ cⱼ·xⱼ = value`, με τυπική απόκλιση `sigma > 0`. */
export interface LinearObservation {
  readonly terms: readonly ObservationTerm[];
  readonly value: number;
  readonly sigma: number;
}

export interface LeastSquaresSolution {
  readonly singular: boolean;
  readonly x: readonly number[];
  /** `vᵢ = aᵢ·x − lᵢ`. */
  readonly residuals: readonly number[];
  /**
   * `Q_xx = N⁻¹`, **επιλεγμένος**: τα στοιχεία που αφορούν τις παρατηρήσεις υπολογίζονται μαζί με τη λύση, κάθε άλλο κατ'
   * απαίτηση (ADR-929 §6.16 #8). Ιδιάζον σύστημα ⇒ κάθε στοιχείο `NaN`.
   */
  readonly cofactor: Cofactor;
  /** Αριθμοί πλεονασμού `rᵢ` (με τα **ενεργά** βάρη). */
  readonly redundancy: readonly number[];
  /** `vᵀ·P·v` (με τα **ενεργά** βάρη). */
  readonly weightedSquareSum: number;
  readonly degreesOfFreedom: number;
}

const SINGULAR: Omit<LeastSquaresSolution, 'x' | 'residuals' | 'redundancy' | 'degreesOfFreedom'> = {
  singular: true,
  cofactor: UNDEFINED_COFACTOR,
  weightedSquareSum: Number.NaN,
};

/** `aᵀ·Q·a` για αραιή γραμμή. */
export function quadraticForm(terms: readonly ObservationTerm[], q: Cofactor): number {
  let sum = 0;
  for (const s of terms) for (const t of terms) sum += s.coefficient * t.coefficient * q.at(s.index, t.index);
  return sum;
}

const evaluate = (terms: readonly ObservationTerm[], x: readonly number[]): number =>
  terms.reduce((sum, t) => sum + t.coefficient * x[t.index], 0);

/**
 * Η **δομή** των κανονικών εξισώσεων ενός συνόλου παρατηρήσεων (κάθε παρατήρηση συνδέει τους αγνώστους της), για όσες
 * επιλύσεις αλλάζουν μόνο **βάρη** — π.χ. οι γύροι του data snooping. Χτίζεται από **όλες** τις παρατηρήσεις.
 */
export function analyzeObservations(obs: readonly LinearObservation[], unknowns: number): SparseAnalysis {
  return analyzeSparsePattern(unknowns, obs.map((o) => o.terms.map((t) => t.index)));
}

function normalEquations(obs: readonly LinearObservation[], analysis: SparseAnalysis, weights: readonly number[]): { n: SparseSymmetricMatrix; u: number[] } {
  const n = new SparseSymmetricMatrix(analysis);
  const u = new Array<number>(analysis.n).fill(0);
  obs.forEach((o, i) => {
    const p = weights[i];
    if (p === 0) return;
    for (const s of o.terms) {
      u[s.index] += p * s.coefficient * o.value;
      // Κάθε μη διατεταγμένο ζεύγος μία φορά (το `add` γράφει και το συμμετρικό)· ίδιος δείκτης δύο φορές ⇒ όλα στη διαγώνιο.
      for (const t of o.terms) if (t.index <= s.index) n.add(s.index, t.index, p * s.coefficient * t.coefficient);
    }
  });
  return { n, u };
}

/**
 * Η συνόρθωση. `weightFactors` (προαιρετικό, ≥ 0) πολλαπλασιάζει τα βάρη `1/σ²` — η επαναστάθμιση του Huber· μηδέν ⇒ η
 * παρατήρηση **δεν** συμμετέχει. Ιδιάζον σύστημα (άγνωστος χωρίς παρατήρηση) ⇒ `singular: true`, ποτέ `NaN` στη λύση.
 * `analysis` (προαιρετικό): η δομή από το {@link analyzeObservations} **των ίδιων** παρατηρήσεων, για όποιον λύνει πολλές
 * φορές με άλλα βάρη· απούσα ⇒ χτίζεται εδώ.
 */
export function solveWeightedLeastSquares(
  obs: readonly LinearObservation[],
  unknowns: number,
  weightFactors?: readonly number[],
  analysis: SparseAnalysis = analyzeObservations(obs, unknowns),
): LeastSquaresSolution {
  const weights = obs.map((o, i) => (weightFactors?.[i] ?? 1) / (o.sigma * o.sigma));
  const active = weights.filter((p) => p > 0).length;
  const { n, u } = normalEquations(obs, analysis, weights);
  const fac = factorSparse(n);
  const empty = { x: new Array<number>(unknowns).fill(0), residuals: obs.map(() => 0), redundancy: obs.map(() => 0), degreesOfFreedom: active - unknowns };
  if (fac.singular) return { ...SINGULAR, ...empty };
  const x = solveSparse(fac, u);
  const cofactor = selectedInverse(fac);
  const residuals = obs.map((o) => evaluate(o.terms, x) - o.value);
  const redundancy = obs.map((o, i) => (weights[i] > 0 ? Math.max(0, 1 - weights[i] * quadraticForm(o.terms, cofactor)) : 0));
  const weightedSquareSum = residuals.reduce((sum, v, i) => sum + weights[i] * v * v, 0);
  return { singular: false, x, residuals, cofactor, redundancy, weightedSquareSum, degreesOfFreedom: active - unknowns };
}

/**
 * Τυποποιημένο υπόλοιπο Baarda (a priori σ₀ = 1). Για **ενεργή** παρατήρηση `vᵢ / (σᵢ·√rᵢ)`· για παρατήρηση **εκτός**
 * συνόρθωσης, το **προβλεπόμενο** υπόλοιπο `vᵢ / √(σᵢ² + aᵢᵀ·Q·aᵢ)`. `null` όταν δεν ελέγχεται (`rᵢ` κάτω από το όριο).
 */
export function standardizedResidual(
  o: LinearObservation,
  residual: number,
  solution: LeastSquaresSolution,
  activeRedundancy: number | null,
  minRedundancy: number,
): number | null {
  if (solution.singular) return null;
  if (activeRedundancy !== null) {
    return activeRedundancy >= minRedundancy ? residual / (o.sigma * Math.sqrt(activeRedundancy)) : null;
  }
  return residual / Math.sqrt(o.sigma * o.sigma + quadraticForm(o.terms, solution.cofactor));
}

/**
 * `δ₀` της μεθόδου B του Baarda για α₀ = 0,001 και ισχύ β = 0,80 (η τιμή των εγχειριδίων γεωδαισίας): η τετραγωνική ρίζα
 * της παραμέτρου μη κεντρικότητας.
 */
export const BAARDA_DELTA0 = 4.13;

/**
 * **Ελάχιστο ανιχνεύσιμο σφάλμα** (Minimal Detectable Bias, εσωτερική αξιοπιστία): `σᵢ·δ₀/√rᵢ`. Ένα σφάλμα μικρότερο
 * από αυτό **δεν** φαίνεται στο τεστ με ισχύ 80%· μεγαλύτερο φαίνεται, όσο μικρό κι αν είναι το `rᵢ`. `null` όταν `rᵢ ≈ 0`.
 */
export function minimalDetectableBias(sigma: number, redundancy: number): number | null {
  return redundancy > 1e-12 ? (sigma * BAARDA_DELTA0) / Math.sqrt(redundancy) : null;
}

/** Ποσοστημόριο της χ² με `df` βαθμούς ελευθερίας (Wilson–Hilferty), για το ολικό τεστ του μοντέλου. */
export function chiSquareQuantile(df: number, z: number): number {
  const a = 2 / (9 * df);
  return df * (1 - a + z * Math.sqrt(a)) ** 3;
}

/** z του 95% (μονόπλευρο) για το ολικό τεστ. */
export const Z_95 = 1.6448536;
