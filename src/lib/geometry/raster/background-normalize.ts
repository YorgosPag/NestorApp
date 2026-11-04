/**
 * =============================================================================
 * ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΦΟΝΤΟΥ ΑΝΑ ΚΑΝΑΛΙ — ΚΙΤΡΙΝΙΣΜΑ, ΣΚΙΑ, ΑΝΟΜΟΙΟΜΟΡΦΟΣ ΦΩΤΙΣΜΟΣ (SSoT)
 * =============================================================================
 *
 * Παλιά σάρωση: το χαρτί είναι **κίτρινο**, πιο σκούρο στη δίπλωση και στις άκρες του σαρωτή. Φωτογραφία κινητού: φως
 * από τη μία πλευρά. Και στα δύο, το «χαρτί» δεν έχει μία τιμή, άρα κανένα κατώφλι δεν το χωρίζει σωστά από το μελάνι.
 *
 * 🏆 **Η μέθοδος των μεγάλων της ψηφιοποίησης εγγράφων** (Leptonica `pixBackgroundNorm`, BSD-2 · ScanTailor · «Whiteboard»
 *   του Office Lens): **εκτίμηση του φόντου** σε αραιό πλέγμα πλακιδίων, γέμισμα όπου το πλακίδιο είναι κυρίως μελάνι,
 *   εξομάλυνση, δι-γραμμική επέκταση σε κάθε pixel, και **διαίρεση** (`v · 255 / φόντο`) — flat-field correction.
 * ➕ **Ανά κανάλι, όχι στο γκρι**: το κίτρινο χαρτί έχει χαμηλό **μπλε**. Η διαίρεση ανά κανάλι κάνει **και** λευκή
 *   ισορροπία, οπότε το χαρτί γίνεται ουδέτερο λευκό και το μελάνι ουδέτερο σκούρο. Η κάτοψη αγγελίας κρατά τα χρώματά
 *   της (το χρώμα ενός χώρου δεν είναι «φόντο»: ένα πλακίδιο μέσα σε χρωματιστό δωμάτιο έχει φωτεινό εκατοστημόριο ≈ το
 *   χρώμα του και μένει έγχρωμο μόνο αν το δωμάτιο είναι μικρότερο από το πλακίδιο — γι' αυτό τα πλακίδια είναι μεγάλα).
 * 🔑 **Εκατοστημόριο, όχι μέσος**: το φόντο ενός πλακιδίου είναι το **φωτεινό** εκατοστημόριο (π.χ. 90ό) του καναλιού,
 *   που αγνοεί το μελάνι όσο αυτό καλύπτει < 10% του πλακιδίου. Πλακίδιο πιο σκούρο από το `invalidBelow` του διάμεσου
 *   φόντου = κυρίως μελάνι (poché) ⇒ γεμίζεται από τους γείτονες, ποτέ δεν «λευκαίνει» τον τοίχο.
 *
 * @module lib/geometry/raster/background-normalize
 */

import { histogramPercentile } from './otsu-threshold';
import type { PlanRaster } from './plan-raster';

export interface BackgroundNormalizeOptions {
  /** Πλευρά πλακιδίου σε pixel. Μεγαλύτερο από το πάχος κάθε γραμμής, μικρότερο από τη σκιά που διορθώνεται. */
  readonly tilePx: number;
  /** Το φωτεινό εκατοστημόριο που λέγεται «χαρτί» (0–1). */
  readonly percentile: number;
  /** Πλακίδιο με φόντο < `invalidBelow × διάμεσος` θεωρείται μελάνι και γεμίζεται από γείτονες. */
  readonly invalidBelow: number;
}

export const DEFAULT_BACKGROUND_NORMALIZE: BackgroundNormalizeOptions = { tilePx: 64, percentile: 0.9, invalidBelow: 0.6 };

/** Το εκτιμημένο φόντο: ένα πλέγμα `gx × gy` πλακιδίων, 3 κανάλια, τιμές 1–255. */
export interface BackgroundGrid {
  readonly gx: number;
  readonly gy: number;
  readonly tilePx: number;
  readonly rgb: Float32Array;
}

function tilePercentiles(src: PlanRaster, tilePx: number, percentile: number): BackgroundGrid {
  const gx = Math.max(1, Math.ceil(src.width / tilePx));
  const gy = Math.max(1, Math.ceil(src.height / tilePx));
  const hist = new Uint32Array(gx * gy * 3 * 256);
  for (let y = 0; y < src.height; y++) {
    const tileRow = Math.floor(y / tilePx) * gx;
    for (let x = 0; x < src.width; x++) {
      const base = (tileRow + Math.floor(x / tilePx)) * 768;
      const o = (y * src.width + x) * 4;
      hist[base + src.rgba[o]]++;
      hist[base + 256 + src.rgba[o + 1]]++;
      hist[base + 512 + src.rgba[o + 2]]++;
    }
  }
  const rgb = new Float32Array(gx * gy * 3);
  // Κάθε πλακίδιο έχει ≥ 1 pixel (το πλέγμα κόβεται στην εικόνα), άρα το εκατοστημόριο υπάρχει· `max(1, …)` = καμία διαίρεση με 0.
  for (let t = 0; t < gx * gy * 3; t++) rgb[t] = Math.max(1, histogramPercentile(hist, percentile, 0, t * 256) ?? 255);
  return { gx, gy, tilePx, rgb };
}

/** Σημαδεύει τα πλακίδια-μελάνι και τα γεμίζει, κύμα-κύμα, με τον μέσο των έγκυρων γειτόνων. */
function fillInkTiles(grid: BackgroundGrid, invalidBelow: number): void {
  const { gx, gy, rgb } = grid;
  const lum = (t: number) => 0.299 * rgb[t * 3] + 0.587 * rgb[t * 3 + 1] + 0.114 * rgb[t * 3 + 2];
  const sorted = Array.from({ length: gx * gy }, (_, t) => lum(t)).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length / 2)] * invalidBelow;
  let valid = Uint8Array.from({ length: gx * gy }, (_, t) => (lum(t) >= floor ? 1 : 0));
  if (!valid.includes(1)) return; // όλη η εικόνα σκούρα: τίποτα αξιόπιστο για να γεμίσει — μένει ως έχει
  while (valid.includes(0)) {
    const next = Uint8Array.from(valid);
    for (let t = 0; t < gx * gy; t++) {
      if (valid[t]) continue;
      const acc = [0, 0, 0];
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = (t % gx) + dx;
        const y = Math.floor(t / gx) + dy;
        if (x < 0 || y < 0 || x >= gx || y >= gy || !valid[y * gx + x]) continue;
        for (let c = 0; c < 3; c++) acc[c] += rgb[(y * gx + x) * 3 + c];
        n++;
      }
      if (n === 0) continue;
      for (let c = 0; c < 3; c++) rgb[t * 3 + c] = acc[c] / n;
      next[t] = 1;
    }
    valid = next;
  }
}

/** Εξομάλυνση 3 × 3 (μέσος με κομμένες άκρες): μια ξαφνική αλλαγή φόντου είναι σχεδόν πάντα μελάνι, όχι φως. */
function smoothGrid(grid: BackgroundGrid): void {
  const { gx, gy, rgb } = grid;
  const copy = Float32Array.from(rgb);
  for (let y = 0; y < gy; y++) {
    for (let x = 0; x < gx; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        let n = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(gy - 1, y + 1); yy++) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(gx - 1, x + 1); xx++) { acc += copy[(yy * gx + xx) * 3 + c]; n++; }
        }
        rgb[(y * gx + x) * 3 + c] = acc / n;
      }
    }
  }
}

/** **Εκτίμηση φόντου** — εκτεθειμένη χωριστά ώστε το test (και η Φ5) να βλέπουν τι θεωρήθηκε «χαρτί». */
export function estimateBackground(src: PlanRaster, options: BackgroundNormalizeOptions = DEFAULT_BACKGROUND_NORMALIZE): BackgroundGrid {
  const grid = tilePercentiles(src, Math.max(4, Math.round(options.tilePx)), options.percentile);
  fillInkTiles(grid, options.invalidBelow);
  smoothGrid(grid);
  return grid;
}

/**
 * Μία γραμμή φόντου: δι-γραμμική τιμή στο κέντρο κάθε pixel της γραμμής `y`, με τα κέντρα των πλακιδίων ως κόμβους.
 * ⚡ Η παρεμβολή κατά `y` γίνεται **μία** φορά ανά γραμμή πλακιδίων (`gx` κόμβοι), και κατά `x` ανά pixel χωρίς closures.
 */
function backgroundRow(grid: BackgroundGrid, y: number, width: number, column: Float32Array, out: Float32Array): void {
  const { gx, gy, rgb, tilePx } = grid;
  const fy = Math.min(gy - 1, Math.max(0, (y + 0.5) / tilePx - 0.5));
  const y0 = Math.floor(fy);
  const y1 = Math.min(gy - 1, y0 + 1);
  const ty = fy - y0;
  for (let i = 0; i < gx * 3; i++) column[i] = rgb[y0 * gx * 3 + i] * (1 - ty) + rgb[y1 * gx * 3 + i] * ty;
  for (let x = 0; x < width; x++) {
    const fx = Math.min(gx - 1, Math.max(0, (x + 0.5) / tilePx - 0.5));
    const x0 = Math.floor(fx);
    const x1 = Math.min(gx - 1, x0 + 1);
    const tx = fx - x0;
    for (let c = 0; c < 3; c++) out[x * 3 + c] = column[x0 * 3 + c] * (1 - tx) + column[x1 * 3 + c] * tx;
  }
}

/** Κάτω από αυτό, μια κανονικοποιημένη τιμή δεν λογίζεται «χαρτί» στο λευκό σημείο. */
const PAPER_FLOOR = 200;

/**
 * **Ολικό λευκό σημείο** (το βήμα τόνου του Leptonica μετά το `pixBackgroundNorm`): το flat-field στέλνει το **φωτεινό
 * εκατοστημόριο** στο 255, άρα με θόρυβο ο **διάμεσος** του χαρτιού μένει κάτω από αυτό (μετρημένο: ~230 με θόρυβο ±25).
 * Εδώ ο διάμεσος του χαρτιού ανά κανάλι γίνεται 255. Δεν κατεβάζουμε αντί γι' αυτό το εκατοστημόριο: το 0,9 είναι που
 * κρατά τις **ανοιχτές διαγραμμίσεις** (πλακίδιο 60% διαγράμμιση με διάμεσο θα «λεύκαινε»).
 */
function applyWhitePoint(rgba: Uint8ClampedArray): void {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let o = 0; o < rgba.length; o += 4) for (let c = 0; c < 3; c++) if (rgba[o + c] >= PAPER_FLOOR) hist[c][rgba[o + c]]++;
  const gain = hist.map((h) => {
    const median = histogramPercentile(h, 0.5, PAPER_FLOOR);
    return median === null ? 1 : 255 / median;
  });
  for (let o = 0; o < rgba.length; o += 4) for (let c = 0; c < 3; c++) rgba[o + c] = rgba[o + c] * gain[c];
}

/**
 * **Χαρτί → λευκό**: κάθε κανάλι διαιρείται με το φόντο του, και μετά ολικό λευκό σημείο. Νέα εικόνα· η πηγή μένει
 * ανέπαφη. Άλφα συντίθεται πάνω σε λευκό (ίδια σύμβαση με το `rgbaToGray`) και βγαίνει 255.
 */
export function normalizeBackground(
  src: PlanRaster, options: BackgroundNormalizeOptions = DEFAULT_BACKGROUND_NORMALIZE,
): PlanRaster & { readonly rgba: Uint8ClampedArray } {
  const grid = estimateBackground(src, options);
  const out = new Uint8ClampedArray(src.width * src.height * 4);
  const column = new Float32Array(grid.gx * 3);
  const bg = new Float32Array(src.width * 3);
  for (let y = 0; y < src.height; y++) {
    backgroundRow(grid, y, src.width, column, bg);
    for (let x = 0; x < src.width; x++) {
      const o = (y * src.width + x) * 4;
      const alpha = src.rgba[o + 3] / 255;
      for (let c = 0; c < 3; c++) out[o + c] = (src.rgba[o + c] * 255 / bg[x * 3 + c]) * alpha + 255 * (1 - alpha);
      out[o + 3] = 255;
    }
  }
  applyWhitePoint(out);
  return { rgba: out, width: src.width, height: src.height };
}
