/**
 * =============================================================================
 * ΠΡΟΣΑΡΜΟΣΤΙΚΗ ΔΥΑΔΟΠΟΙΗΣΗ — SAUVOLA ΚΑΙ WOLF–JOLION ΜΕ ΕΙΚΟΝΕΣ ΟΛΟΚΛΗΡΩΜΑΤΟΣ (SSoT)
 * =============================================================================
 *
 * Το Otsu ({@link ./otsu-threshold}) δίνει **ένα** κατώφλι για όλη την εικόνα. Σε σάρωση με λεκέ, σκιά δίπλωσης ή
 * ξεθωριασμένο μολύβι, ένα κατώφλι δεν αρκεί. Τα τοπικά κατώφλια ρωτούν τη **γειτονιά** κάθε pixel:
 *
 * - **Sauvola & Pietikäinen (2000):** `T = m · (1 + k · (s / R − 1))`, με `m`, `s` τον μέσο και την τυπική απόκλιση του
 *   παραθύρου. Σε επίπεδο χαρτί (`s` μικρό) το κατώφλι πέφτει κάτω από το χαρτί και ο θόρυβος **δεν** γίνεται μελάνι.
 *   Η μελέτη των Trier & Jain σε **ελληνικά** έγγραφα το βρήκε το καλύτερο από τα τοπικά (κατά Shafait 2008).
 * - **Wolf & Jolion (2004):** `T = (1 − k)·m + k·M + k·(s / Smax)·(m − M)`, όπου `M` το ελάχιστο γκρι της εικόνας και
 *   `Smax` η μέγιστη τοπική απόκλιση. Κανονικοποιεί με το **κοντράστ της ίδιας της εικόνας** αντί για το σταθερό
 *   `R = 128`, γι' αυτό αντέχει σάρωση χαμηλού κοντράστ (ξεθωριασμένο φωτοαντίγραφο), όπου το Sauvola χάνει γραμμές.
 *
 * ⚡ O(κελιά) για **κάθε** μέγεθος παραθύρου (Shafait, Keysers & Breuel, DRR 2008), μέσω {@link integralImages}.
 * ⚠️ **Τυφλό σημείο και των δύο**: σε γεμάτη περιοχή μελανιού **φαρδύτερη από το παράθυρο** (poché τοίχος) το παράθυρο
 *   βλέπει μόνο μελάνι, `s ≈ 0`, και το κέντρο «αδειάζει». Ο καλών είτε διαλέγει παράθυρο > 2 × πάχος, είτε το
 *   συνδυάζει με ολικό κατώφλι ({@link ./otsu-threshold}) — η απόφαση είναι του καλούντα, εδώ μένει ο αλγόριθμος καθαρός.
 *
 * @module lib/geometry/raster/adaptive-threshold
 */

import { integralImages, type IntegralImages } from './integral-image';

export type AdaptiveThresholdMethod = 'sauvola' | 'wolf';

export interface AdaptiveThresholdOptions {
  readonly method: AdaptiveThresholdMethod;
  /** Πλευρά του τετράγωνου παραθύρου, σε pixel (μονός αριθμός προτιμάται· το κέντρο είναι το pixel). */
  readonly windowPx: number;
  /** Ευαισθησία `k`: Sauvola 0,2–0,5 · Wolf 0,5. Μεγαλύτερο ⇒ λιγότερο μελάνι. */
  readonly k: number;
  /** Δυναμικό εύρος `R` της τυπικής απόκλισης (μόνο Sauvola· 128 για 8 bit). */
  readonly r?: number;
}

export const DEFAULT_SAUVOLA: AdaptiveThresholdOptions = { method: 'sauvola', windowPx: 31, k: 0.2, r: 128 };
export const DEFAULT_WOLF: AdaptiveThresholdOptions = { method: 'wolf', windowPx: 31, k: 0.5 };

/** Μέσος και τυπική απόκλιση του παραθύρου γύρω από `(c, r)` — εσωτερικός βρόχος, χωρίς δέσμευση αντικειμένου. */
function windowAt(ii: IntegralImages, c: number, r: number, half: number, out: Float64Array): void {
  const stride = ii.cols + 1;
  const x0 = Math.max(0, c - half);
  const y0 = Math.max(0, r - half);
  const x1 = Math.min(ii.cols, c + half + 1);
  const y1 = Math.min(ii.rows, r + half + 1);
  const n = (x1 - x0) * (y1 - y0);
  const a = y0 * stride + x0;
  const b = y0 * stride + x1;
  const d = y1 * stride + x0;
  const e = y1 * stride + x1;
  const mean = (ii.sum[e] - ii.sum[b] - ii.sum[d] + ii.sum[a]) / n;
  const sq = (ii.sumSq[e] - ii.sumSq[b] - ii.sumSq[d] + ii.sumSq[a]) / n;
  out[0] = mean;
  out[1] = Math.sqrt(Math.max(0, sq - mean * mean));
}

/** Μέγιστη τοπική απόκλιση και ελάχιστο γκρι — οι δύο ολικές ποσότητες του Wolf–Jolion. */
function wolfGlobals(gray: Uint8Array, ii: IntegralImages, half: number): { readonly sMax: number; readonly minGray: number } {
  const stats = new Float64Array(2);
  let sMax = 0;
  let minGray = 255;
  for (let r = 0; r < ii.rows; r++) {
    for (let c = 0; c < ii.cols; c++) {
      windowAt(ii, c, r, half, stats);
      if (stats[1] > sMax) sMax = stats[1];
      const v = gray[r * ii.cols + c];
      if (v < minGray) minGray = v;
    }
  }
  return { sMax, minGray };
}

/**
 * Μάσκα μελανιού (`1` = μελάνι, δηλαδή pixel **≤** του τοπικού κατωφλίου). Ίδια είσοδος με το `inkMask` του ADR-884:
 * γκρι 0–255 ανά pixel (από το `rgbaToGray`).
 */
export function adaptiveInkMask(gray: Uint8Array, cols: number, rows: number, options: AdaptiveThresholdOptions): Uint8Array {
  const ink = new Uint8Array(cols * rows);
  if (cols === 0 || rows === 0) return ink;
  const ii = integralImages(gray, cols, rows);
  const half = Math.max(1, Math.floor(options.windowPx / 2));
  const { k } = options;
  const stats = new Float64Array(2);
  const wolf = options.method === 'wolf' ? wolfGlobals(gray, ii, half) : null;
  const r = options.r ?? 128;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      windowAt(ii, c, row, half, stats);
      const [m, s] = stats;
      const t = wolf === null
        ? m * (1 + k * (s / r - 1))
        : (1 - k) * m + k * wolf.minGray + (wolf.sMax > 0 ? k * (s / wolf.sMax) * (m - wolf.minGray) : 0);
      const i = row * cols + c;
      ink[i] = gray[i] <= t ? 1 : 0;
    }
  }
  return ink;
}
