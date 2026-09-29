/**
 * =============================================================================
 * ΕΥΚΛΕΙΔΕΙΟΣ DISTANCE TRANSFORM (SSoT) — Felzenszwalb & Huttenlocher 2012, ακριβής, O(κελιά)
 * =============================================================================
 *
 * Για κάθε κελί: **τετράγωνο** της απόστασης (σε κελιά) από το πλησιέστερο κελί «πηγή» (`mask === 1`). Ακριβής
 * ευκλείδεια — όχι chamfer/Manhattan — ώστε η μορφολογία με δίσκο να είναι **δίσκος** (μια πόρτα 0,9 m κλείνει
 * το ίδιο σε κάθε γωνία της κάτοψης, όχι μόνο στις οριζόντιες/κάθετες).
 *
 * Δύο περάσματα της μονοδιάστατης κάτω περιβάλλουσας παραβολών (στήλες, μετά γραμμές).
 * Πηγή: P. Felzenszwalb, D. Huttenlocher, «Distance Transforms of Sampled Functions», Theory of Computing 8 (2012).
 *
 * @module lib/geometry/raster/distance-transform
 */

/**
 * «Άπειρο» ως **πεπερασμένος** αριθμός: με `Infinity` ο τύπος τομής παραβολών δίνει `∞ − ∞ = NaN`. Μεγαλύτερο από
 * κάθε πραγματικό τετράγωνο απόστασης σε πλέγμα ως 10⁶ × 10⁶.
 */
export const DT_FAR = 1e20;

/** Κοινοί πίνακες εργασίας μιας γραμμής (δεσμεύονται μία φορά ανά κλήση, όχι ανά γραμμή). */
interface Scratch {
  readonly f: Float64Array;
  readonly d: Float64Array;
  readonly v: Int32Array;
  readonly z: Float64Array;
}

/** Τομή των παραβολών με κορυφές `q` και `p`. */
function parabolaIntersection(f: Float64Array, q: number, p: number): number {
  return ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
}

/** Μονοδιάστατο DT: `s.d[i] = min_j (i − j)² + s.f[j]`, για `i < n`. */
function transform1d(s: Scratch, n: number): void {
  const { f, d, v, z } = s;
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let x = parabolaIntersection(f, q, v[k]);
    while (x <= z[k]) {
      k--;
      x = parabolaIntersection(f, q, v[k]);
    }
    k++;
    v[k] = q;
    z[k] = x;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/**
 * Τετράγωνο ευκλείδειας απόστασης κάθε κελιού από το πλησιέστερο κελί με `mask[i] === 1`. Χωρίς κανένα τέτοιο
 * κελί, κάθε τιμή είναι ≥ {@link DT_FAR}.
 */
export function squaredDistanceTransform(mask: Uint8Array, cols: number, rows: number): Float64Array {
  const out = new Float64Array(cols * rows);
  const len = Math.max(cols, rows);
  const s: Scratch = {
    f: new Float64Array(len), d: new Float64Array(len), v: new Int32Array(len), z: new Float64Array(len + 1),
  };
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) s.f[r] = mask[r * cols + c] === 1 ? 0 : DT_FAR;
    transform1d(s, rows);
    for (let r = 0; r < rows; r++) out[r * cols + c] = s.d[r];
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) s.f[c] = out[r * cols + c];
    transform1d(s, cols);
    for (let c = 0; c < cols; c++) out[r * cols + c] = s.d[c];
  }
  return out;
}
