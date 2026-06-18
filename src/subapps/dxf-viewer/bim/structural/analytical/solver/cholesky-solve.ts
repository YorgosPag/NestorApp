/**
 * Symmetric linear solve via LDLᵀ — in-house (ADR-481, T3 / S1).
 *
 * Επιλύει K·u = F όπου K **συμμετρικό** (μητρώο δυσκαμψίας πλαισίου μετά τα BC).
 * Χρησιμοποιούμε LDLᵀ αντί καθαρού Cholesky ώστε να εντοπίζουμε **μηδενικό/αρνητικό
 * pivot** → ο φορέας είναι **μηχανισμός** (singular K, μη-ευσταθής) χωρίς να σκάει
 * σε √(αρνητικού). Η penalty-based μέθοδος διαφράγματος κρατά το K θετικά ορισμένο
 * στις έγκυρες περιπτώσεις, οπότε ένα σχεδόν-μηδενικό pivot σημαίνει πραγματικό
 * μηχανισμό (απελευθερωμένος βαθμός ελευθερίας).
 *
 * Pure — zero deps πέραν των primitives.
 *
 * @see ./dense-matrix.ts
 * @see ./analysis-diagnostics.ts — μετατρέπει το `singular` σε StructuralDiagnostic
 */

import { maxAbsDiagonal, zeroVector, type Matrix, type Vector, type MutableVector } from './dense-matrix';

/** Σχετικό κατώφλι για μηδενικό pivot (μηχανισμός) ως προς το max διαγώνιο. */
const PIVOT_REL_TOL = 1e-12;

/** Αποτέλεσμα επίλυσης: η λύση + σημαία μηχανισμού (singular K). */
export interface SolveResult {
  /** Το διάνυσμα λύσης u (μηδενικό όταν `singular`). */
  readonly solution: Vector;
  /** True όταν το K είναι (σχεδόν) ιδιάζον → μηχανισμός, η λύση δεν είναι έγκυρη. */
  readonly singular: boolean;
}

/** LDLᵀ παραγοντοποίηση: επιστρέφει L (unit-lower) + D (διαγώνιο) ή singular. */
interface Factorization {
  readonly lower: number[][];
  readonly diagonal: number[];
  readonly singular: boolean;
}

/**
 * Παραγοντοποίηση A = L·D·Lᵀ (L μοναδιαία κάτω τριγωνική, D διαγώνιο). Σχεδόν-
 * μηδενικό pivot (ως προς το max διαγώνιο) → `singular: true` (early-out).
 */
function factorize(a: Matrix, tol: number): Factorization {
  const n = a.length;
  const lower = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const diagonal = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    let dj = a[j][j];
    for (let k = 0; k < j; k++) dj -= lower[j][k] * lower[j][k] * diagonal[k];
    if (Math.abs(dj) <= tol) return { lower, diagonal, singular: true };
    diagonal[j] = dj;
    lower[j][j] = 1;
    for (let i = j + 1; i < n; i++) {
      let lij = a[i][j];
      for (let k = 0; k < j; k++) lij -= lower[i][k] * lower[j][k] * diagonal[k];
      lower[i][j] = lij / dj;
    }
  }
  return { lower, diagonal, singular: false };
}

/** Εμπρόσθια αντικατάσταση L·y = f (L μοναδιαία κάτω τριγωνική). */
function forwardSolve(lower: number[][], f: Vector): MutableVector {
  const n = f.length;
  const y = zeroVector(n);
  for (let i = 0; i < n; i++) {
    let sum = f[i];
    for (let k = 0; k < i; k++) sum -= lower[i][k] * y[k];
    y[i] = sum;
  }
  return y;
}

/** Οπίσθια αντικατάσταση Lᵀ·x = z (μετά τη διαίρεση με D). */
function backwardSolve(lower: number[][], z: Vector): MutableVector {
  const n = z.length;
  const x = zeroVector(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = z[i];
    for (let k = i + 1; k < n; k++) sum -= lower[k][i] * x[k];
    x[i] = sum;
  }
  return x;
}

/**
 * Επίλυσε το συμμετρικό σύστημα K·u = F. Επιστρέφει `singular: true` (+ μηδενική
 * λύση) όταν το K είναι μηχανισμός — ο caller το μετατρέπει σε diagnostic, ΔΕΝ
 * εμπιστεύεται το `solution`.
 *
 * `stiffnessScale` (προαιρετικό): η **φυσική** κλίμακα ακαμψίας (max διαγώνιο ΠΡΙΝ
 * το penalty διαφράγματος) ως αναφορά για το κατώφλι μηδενικού pivot. Όταν δίνεται,
 * η ανίχνευση μηχανισμού είναι ανεξάρτητη του penalty inflation: ένα penalty-stiffened
 * διαγώνιο (~1e6× μεγαλύτερο) δεν ανεβάζει το tol ώστε να «κόβει» γνήσια μικρά pivots
 * (false-singular σε έγκυρο πλαίσιο). Default = `maxAbsDiagonal(k)` (legacy).
 */
export function solveSymmetric(k: Matrix, f: Vector, stiffnessScale?: number): SolveResult {
  const n = k.length;
  if (n === 0) return { solution: [], singular: false };
  const scale = stiffnessScale !== undefined ? stiffnessScale : maxAbsDiagonal(k);
  const tol = Math.max(scale * PIVOT_REL_TOL, Number.MIN_VALUE);
  const fac = factorize(k, tol);
  if (fac.singular) return { solution: zeroVector(n), singular: true };
  const y = forwardSolve(fac.lower, f);
  for (let i = 0; i < n; i++) y[i] /= fac.diagonal[i];
  return { solution: backwardSolve(fac.lower, y), singular: false };
}
