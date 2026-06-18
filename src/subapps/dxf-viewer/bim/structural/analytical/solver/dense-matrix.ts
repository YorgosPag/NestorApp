/**
 * Dense matrix primitives — in-house γραμμική άλγεβρα (ADR-481, T3 / S1).
 *
 * Ελάχιστο πυκνό μητρώο/διάνυσμα + βασικές πράξεις για τον στατικό FEM solver
 * του 3D χωρικού πλαισίου. **Δεν** εισάγουμε εξωτερικό math package: τα μητρώα
 * δυσκαμψίας πλαισίου είναι μικρά πυκνά συστήματα (6·κόμβοι DOF — δεκάδες έως
 * εκατοντάδες), όπου ένας στοχευμένος in-house solver είναι πλήρως ελεγχόμενος,
 * unit-testable και χωρίς license/dependency ρίσκο (N.5 N/A).
 *
 * Μονάδες-agnostic: ο caller κρατά συνεπές σύστημα (kN, m, rad — βλ. solver-units).
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./cholesky-solve.ts — η LDLᵀ επίλυση K·u=F
 * @see docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md
 */

/** Πυκνό μητρώο (row-major). Ορθογώνιο: όλες οι γραμμές ίδιο μήκος. */
export type Matrix = readonly number[][];
/** Πυκνό διάνυσμα. */
export type Vector = readonly number[];

/** Μεταλλάξιμο μητρώο υπό κατασκευή (assembly accumulation). */
export type MutableMatrix = number[][];
/** Μεταλλάξιμο διάνυσμα υπό κατασκευή. */
export type MutableVector = number[];

/** Τετράγωνο μηδενικό μητρώο n×n. */
export function zeroMatrix(n: number): MutableMatrix {
  const m: MutableMatrix = new Array(n);
  for (let i = 0; i < n; i++) m[i] = new Array<number>(n).fill(0);
  return m;
}

/** Μηδενικό διάνυσμα μήκους n. */
export function zeroVector(n: number): MutableVector {
  return new Array<number>(n).fill(0);
}

/**
 * Πρόσθεσε ένα μικρό block (μέγεθος = `dofs.length`) στο μεγάλο μητρώο, στις
 * γραμμές/στήλες που δείχνει το `dofs` (scatter — assembly στοιχειακού μητρώου).
 */
export function scatterAdd(target: MutableMatrix, block: Matrix, dofs: readonly number[]): void {
  for (let i = 0; i < dofs.length; i++) {
    const ti = dofs[i];
    for (let j = 0; j < dofs.length; j++) {
      target[ti][dofs[j]] += block[i][j];
    }
  }
}

/**
 * Πρόσθεσε ένα μικρό διάνυσμα (μέγεθος = `dofs.length`) στο μεγάλο διάνυσμα,
 * στις θέσεις που δείχνει το `dofs` (scatter — assembly κομβικού φορτίου).
 */
export function scatterAddVector(target: MutableVector, block: Vector, dofs: readonly number[]): void {
  for (let i = 0; i < dofs.length; i++) target[dofs[i]] += block[i];
}

/** Μάζεψε ένα υπο-διάνυσμα από τις θέσεις `indices` (gather — element DOF extract). */
export function gatherVector(v: Vector, indices: readonly number[]): MutableVector {
  return indices.map((i) => v[i]);
}

/** Γινόμενο μητρώου × διάνυσμα (A·x). Προϋποθέτει συμβατές διαστάσεις. */
export function matVec(a: Matrix, x: Vector): MutableVector {
  const rows = a.length;
  const out = zeroVector(rows);
  for (let i = 0; i < rows; i++) {
    const row = a[i];
    let sum = 0;
    for (let j = 0; j < row.length; j++) sum += row[j] * x[j];
    out[i] = sum;
  }
  return out;
}

/** Ανάστροφο μητρώο Aᵀ. */
export function transpose(a: Matrix): MutableMatrix {
  const rows = a.length;
  const cols = rows > 0 ? a[0].length : 0;
  const out = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j][i] = a[i][j];
  }
  return out;
}

/** Γινόμενο μητρώων A·B (A: m×k, B: k×n → m×n). Προϋποθέτει συμβατές διαστάσεις. */
export function matMul(a: Matrix, b: Matrix): MutableMatrix {
  const m = a.length;
  const inner = b.length;
  const n = inner > 0 ? b[0].length : 0;
  const out = Array.from({ length: m }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < inner; p++) {
      const aip = a[i][p];
      if (aip === 0) continue;
      const brow = b[p];
      for (let j = 0; j < n; j++) out[i][j] += aip * brow[j];
    }
  }
  return out;
}

/** Μεγαλύτερο διαγώνιο στοιχείο κατ' απόλυτη τιμή (κλίμακα για κατώφλια). */
export function maxAbsDiagonal(a: Matrix): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i][i]);
    if (v > max) max = v;
  }
  return max;
}
