/**
 * =============================================================================
 * ΕΙΚΟΝΕΣ ΟΛΟΚΛΗΡΩΜΑΤΟΣ (summed-area tables) — ΑΘΡΟΙΣΜΑ ΚΑΙ ΑΘΡΟΙΣΜΑ ΤΕΤΡΑΓΩΝΩΝ (SSoT)
 * =============================================================================
 *
 * Μέσος όρος και διακύμανση **οποιουδήποτε** ορθογωνίου σε O(1), ανεξάρτητα από το μέγεθός του (Crow 1984 · Viola–Jones
 * 2001). Είναι το κόλπο του Shafait, Keysers & Breuel (DRR 2008) που κάνει τη δυαδοποίηση Sauvola **όσο γρήγορη όσο το
 * Otsu**, για κάθε μέγεθος παραθύρου (μετρημένο εκεί: ×20 στο UW-1).
 *
 * 🔑 `Float64Array` και όχι `Uint32Array`: σε εικόνα 16 MP το άθροισμα τετραγώνων φτάνει 16e6 × 255² ≈ 1e12 > 2³².
 *   Το `Float64` κρατά ακέραιους ως 2⁵³ ακριβώς.
 * 📏 Διάταξη `(cols + 1) × (rows + 1)` με μηδενική πρώτη γραμμή/στήλη: κανένας έλεγχος ορίων στο ερώτημα.
 *
 * @module lib/geometry/raster/integral-image
 */

export interface IntegralImages {
  readonly sum: Float64Array;
  readonly sumSq: Float64Array;
  /** Πλάτος της **εικόνας** (ο πίνακας έχει `cols + 1` στήλες). */
  readonly cols: number;
  readonly rows: number;
}

/** Χτίζει και τους δύο πίνακες με **ένα** πέρασμα. */
export function integralImages(gray: Uint8Array, cols: number, rows: number): IntegralImages {
  const stride = cols + 1;
  const sum = new Float64Array(stride * (rows + 1));
  const sumSq = new Float64Array(stride * (rows + 1));
  for (let r = 0; r < rows; r++) {
    let rowSum = 0;
    let rowSq = 0;
    const above = r * stride;
    const here = above + stride;
    for (let c = 0; c < cols; c++) {
      const v = gray[r * cols + c];
      rowSum += v;
      rowSq += v * v;
      sum[here + c + 1] = sum[above + c + 1] + rowSum;
      sumSq[here + c + 1] = sumSq[above + c + 1] + rowSq;
    }
  }
  return { sum, sumSq, cols, rows };
}

export interface WindowStats {
  readonly mean: number;
  readonly variance: number;
  readonly count: number;
}

/**
 * Στατιστικά του ορθογωνίου `[x0, x1) × [y0, y1)`, **κομμένου** στην εικόνα (ένα παράθυρο στην άκρη μετρά μόνο ό,τι
 * υπάρχει — δεν «βλέπει» φανταστικό λευκό ή μαύρο έξω). Κενό ορθογώνιο ⇒ `count = 0`, μέσος 0.
 */
export function windowStats(ii: IntegralImages, x0: number, y0: number, x1: number, y1: number): WindowStats {
  const ax = Math.max(0, x0);
  const ay = Math.max(0, y0);
  const bx = Math.min(ii.cols, x1);
  const by = Math.min(ii.rows, y1);
  const count = Math.max(0, bx - ax) * Math.max(0, by - ay);
  if (count === 0) return { mean: 0, variance: 0, count: 0 };
  const stride = ii.cols + 1;
  const box = (t: Float64Array) => t[by * stride + bx] - t[ay * stride + bx] - t[by * stride + ax] + t[ay * stride + ax];
  const mean = box(ii.sum) / count;
  return { mean, variance: Math.max(0, box(ii.sumSq) / count - mean * mean), count };
}
