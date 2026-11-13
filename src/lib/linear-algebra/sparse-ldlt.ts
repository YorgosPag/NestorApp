/**
 * @fileoverview **ΑΡΑΙΗ LDLᵀ ΚΑΙ ΕΠΙΛΕΓΜΕΝΟΣ ΑΝΤΙΣΤΡΟΦΟΣ** (SSoT) — η αριθμητική πάνω στην ανάλυση του `./sparse-ordering.ts`.
 * @module lib/linear-algebra/sparse-ldlt
 * @related `./sparse-ordering.ts` (διάταξη + δομή) · `./weighted-least-squares.ts` (ο καταναλωτής) · `./ldlt-solve.ts` (η
 *   πυκνή εκδοχή, για τον FEM)
 *
 * 🔑 **Δεν χρειάζεται όλος ο αντίστροφος.** Το τεστ Baarda θέλει `aᵢᵀ·Q·aᵢ` για κάθε παρατήρηση, δηλαδή τα στοιχεία του
 * `Q = N⁻¹` μόνο στα ζεύγη αγνώστων **μιας** παρατήρησης — που ανήκουν όλα στη δομή του `N`, άρα και του `L`. Οι εξισώσεις
 * Takahashi (1973) δίνουν ακριβώς αυτά τα στοιχεία από τον παράγοντα, σε κόστος Σ|στήλη|² αντί για `n` πλήρεις επιλύσεις
 * (O(n³)): μετρημένο ADR-929 §6.16 #8, 1 380 ms από τα 1 652 της συνόρθωσης ήταν ο ρητός `Q_xx`.
 * 🔑 **Κάθε άλλο στοιχείο, σωστό πάντα.** Ζήτηση εκτός δομής (π.χ. η Ιακωβιανή μιας γωνίας στην καταγραφή) ⇒ η στήλη λύνεται
 * κατ' απαίτηση από τον παράγοντα και κρατιέται. Το `at(i, j)` δεν επιστρέφει ποτέ «μηδέν επειδή δεν υπολογίστηκε».
 * 🔑 **Ίδιο κατώφλι ιδιάζοντος με την πυκνή**: σχετικό 1e-12 ως προς το μέγιστο διαγώνιο (`./ldlt-solve.ts`).
 *
 * 📐 Πηγές: Takahashi, Fagan & Chin (1973) «Formation of a sparse bus impedance matrix and its application to short circuit
 *   study»· Erisman & Tinney (1975) «On computing certain elements of the inverse of a sparse matrix»· Davis (2006).
 */

import type { SparseAnalysis } from './sparse-ordering';

const PIVOT_REL_TOL = 1e-12;

/** Στοιχεία του αντιστρόφου (μητρώο συμμεταβλητότητας ανά μονάδα βάρους), σε **αρχικούς** δείκτες. */
export interface Cofactor {
  readonly size: number;
  at(i: number, j: number): number;
}

/** Ο αντίστροφος ενός ιδιάζοντος συστήματος: δεν υπάρχει — κάθε στοιχείο `NaN`, ποτέ σιωπηλό μηδέν. */
export const UNDEFINED_COFACTOR: Cofactor = { size: 0, at: () => Number.NaN };

/** Συμμετρικό αραιό μητρώο στη δομή μιας ανάλυσης· μόνο το κάτω τρίγωνο, σε **διατεταγμένους** δείκτες. */
export class SparseSymmetricMatrix {
  readonly diagonal: Float64Array;
  /** `lower[k].get(i)` = στοιχείο (i, k), i > k. */
  readonly lower: Map<number, number>[];

  constructor(readonly analysis: SparseAnalysis) {
    this.diagonal = new Float64Array(analysis.n);
    this.lower = Array.from({ length: analysis.n }, () => new Map<number, number>());
  }

  /** Πρόσθεσε `v` στο (i, j) **και** (j, i) — αρχικοί δείκτες. Εκτός δομής ⇒ σφάλμα προγραμματισμού. */
  add(i: number, j: number, v: number): void {
    const p = this.analysis.position[i];
    const q = this.analysis.position[j];
    if (p === q) {
      this.diagonal[p] += v;
      return;
    }
    const [row, col] = p > q ? [p, q] : [q, p];
    const column = this.lower[col];
    if (!this.analysis.columnRows[col].includes(row)) throw new RangeError(`sparse-ldlt: (${i}, ${j}) εκτός δομής`);
    column.set(row, (column.get(row) ?? 0) + v);
  }
}

/** Ο παράγοντας `L·D·Lᵀ`: στήλες του `L` στη δομή της ανάλυσης (γραμμές `columnRows[k]`, τιμές στην ίδια θέση). */
export interface SparseFactorization {
  readonly analysis: SparseAnalysis;
  readonly singular: boolean;
  readonly diagonal: Float64Array;
  readonly columns: readonly Float64Array[];
}

/** Η θέση της γραμμής `row` μέσα στη στήλη `rows` (αύξουσα), ή −1. */
function indexIn(rows: Int32Array, row: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid] === row) return mid;
    if (rows[mid] < row) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Μία στήλη αριστερής παραγοντοποίησης: w = A[:,k] − Σⱼ L[:,j]·L[k][j]·d[j], στον κοινό χώρο εργασίας `w`. */
function eliminateColumn(m: SparseSymmetricMatrix, k: number, columns: Float64Array[], d: Float64Array, w: Float64Array): void {
  const { columnRows, rowColumns } = m.analysis;
  w[k] = m.diagonal[k];
  for (const [i, v] of m.lower[k]) w[i] = v;
  for (const j of rowColumns[k]) {
    const rows = columnRows[j];
    const vals = columns[j];
    const at = indexIn(rows, k);
    const f = vals[at] * d[j];
    for (let t = at; t < rows.length; t++) w[rows[t]] -= vals[t] * f;
  }
}

/** Η αριθμητική LDLᵀ. Μηδενικό pivot (σχετικά με το μέγιστο διαγώνιο) ⇒ `singular: true`. */
export function factorSparse(m: SparseSymmetricMatrix): SparseFactorization {
  const { n, columnRows } = m.analysis;
  let scale = 0;
  for (let k = 0; k < n; k++) scale = Math.max(scale, Math.abs(m.diagonal[k]));
  const tol = Math.max(scale * PIVOT_REL_TOL, Number.MIN_VALUE);
  const d = new Float64Array(n);
  const columns = columnRows.map((rows) => new Float64Array(rows.length));
  const w = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    eliminateColumn(m, k, columns, d, w);
    if (Math.abs(w[k]) <= tol) return { analysis: m.analysis, singular: true, diagonal: d, columns };
    d[k] = w[k];
    w[k] = 0;
    const rows = columnRows[k];
    for (let t = 0; t < rows.length; t++) {
      columns[k][t] = w[rows[t]] / d[k];
      w[rows[t]] = 0;
    }
  }
  return { analysis: m.analysis, singular: false, diagonal: d, columns };
}

/** Λύση `N·x = b` με έτοιμο, **μη ιδιάζοντα** παράγοντα· είσοδος και έξοδος σε **αρχικούς** δείκτες. */
export function solveSparse(f: SparseFactorization, b: ArrayLike<number>): number[] {
  const { n, order, columnRows } = f.analysis;
  const y = new Float64Array(n);
  for (let k = 0; k < n; k++) y[k] = b[order[k]];
  for (let k = 0; k < n; k++) {
    const rows = columnRows[k];
    for (let t = 0; t < rows.length; t++) y[rows[t]] -= f.columns[k][t] * y[k];
  }
  for (let k = 0; k < n; k++) y[k] /= f.diagonal[k];
  for (let k = n - 1; k >= 0; k--) {
    const rows = columnRows[k];
    let s = y[k];
    for (let t = 0; t < rows.length; t++) s -= f.columns[k][t] * y[rows[t]];
    y[k] = s;
  }
  const x = new Array<number>(n);
  for (let k = 0; k < n; k++) x[order[k]] = y[k];
  return x;
}

/** Οι εξισώσεις Takahashi: τα στοιχεία του `N⁻¹` στη δομή του `L` (+ διαγώνιο), από την τελευταία στήλη προς την πρώτη. */
function takahashi(f: SparseFactorization): { diag: Float64Array; lower: Float64Array[] } {
  const { n, columnRows } = f.analysis;
  const diag = new Float64Array(n);
  const lower = columnRows.map((rows) => new Float64Array(rows.length));
  const z = (i: number, j: number): number => {
    if (i === j) return diag[i];
    const [r, c] = i > j ? [i, j] : [j, i];
    return lower[c][indexIn(columnRows[c], r)];
  };
  for (let k = n - 1; k >= 0; k--) {
    const rows = columnRows[k];
    const l = f.columns[k];
    for (let a = 0; a < rows.length; a++) {
      let s = 0;
      for (let b = 0; b < rows.length; b++) s += l[b] * z(rows[a], rows[b]);
      lower[k][a] = -s;
    }
    let s = 1 / f.diagonal[k];
    for (let b = 0; b < rows.length; b++) s -= l[b] * lower[k][b];
    diag[k] = s;
  }
  return { diag, lower };
}

/**
 * Ο **επιλεγμένος** αντίστροφος ως {@link Cofactor}: στοιχεία στη δομή από τις εξισώσεις Takahashi, κάθε άλλο από λύση της
 * στήλης του κατ' απαίτηση (κρατιέται). Ιδιάζων παράγοντας ⇒ {@link UNDEFINED_COFACTOR}.
 */
export function selectedInverse(f: SparseFactorization): Cofactor {
  if (f.singular) return UNDEFINED_COFACTOR;
  const { n, position, columnRows } = f.analysis;
  const { diag, lower } = takahashi(f);
  const solvedColumns = new Map<number, number[]>();
  const column = (j: number): number[] => {
    let col = solvedColumns.get(j);
    if (col === undefined) {
      const e = new Float64Array(n);
      e[j] = 1;
      col = solveSparse(f, e);
      solvedColumns.set(j, col);
    }
    return col;
  };
  return {
    size: n,
    at(i: number, j: number): number {
      const p = position[i];
      const q = position[j];
      if (p === q) return diag[p];
      const [r, c] = p > q ? [p, q] : [q, p];
      const t = indexIn(columnRows[c], r);
      return t >= 0 ? lower[c][t] : column(j)[i];
    },
  };
}
