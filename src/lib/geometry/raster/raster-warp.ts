/**
 * =============================================================================
 * ΑΝΑΔΕΙΓΜΑΤΙΣΗ ΕΙΚΟΝΑΣ — ΜΕΙΩΣΗ ΜΕ ΜΕΣΟ ΠΕΡΙΟΧΗΣ ΚΑΙ ΠΑΡΑΜΟΡΦΩΣΗ ΜΕ ΟΜΟΓΡΑΦΙΑ (SSoT)
 * =============================================================================
 *
 * Δύο πράξεις, μία σύμβαση συντεταγμένων: **συνεχής χώρος pixel**, όπου το pixel `(i, j)` καλύπτει το `[i, i+1) × [j, j+1)`
 * και το κέντρο του είναι `(i + ½, j + ½)`. Η ίδια με το `getImageData`, το `drawImage` και το `raster-px` (ADR-794).
 * Χωρίς αυτήν, κάθε μείωση ή περιστροφή θα μετατόπιζε την εικόνα κατά μισό pixel και η ομογραφία της ευθυγράμμισης
 * (ADR-929 Δ3) θα έδειχνε λάθος σημείο στην αρχική εικόνα.
 *
 * - **Μείωση με ακέραιο συντελεστή**, μέσος όρος περιοχής (box filter): το pixel εξόδου `(i, j)` είναι ο μέσος του
 *   `[i·f, (i+1)·f) × [j·f, (j+1)·f)` της πηγής. **Ακριβής** απεικόνιση `πηγή = f · έξοδος` (χωρίς στρογγύλευση) και
 *   κανένα aliasing (μια λεπτή γραμμή 1 px δεν εξαφανίζεται σε μείωση ×4, γίνεται γκρι).
 * - **Αντίστροφη παραμόρφωση** (inverse mapping): για κάθε pixel εξόδου, η ομογραφία `έξοδος → πηγή` λέει πού να
 *   διαβάσει. Εικόνα: δι-γραμμική δειγματοληψία, έξω από την πηγή **λευκό χαρτί**. Μάσκα: πλησιέστερος γείτονας (μια
 *   μάσκα δεν έχει «μισό μελάνι»), έξω από την πηγή `0`. **Ένας** επαναλήπτης δειγμάτων για τα δύο.
 * - **Περιστροφή ισιώματος**: η ομογραφία που φέρνει ευθείες γωνίας `θ` στο οριζόντιο, με καμβά που χωρά ολόκληρη την
 *   εικόνα. Τη χρησιμοποιούν η ευθυγράμμιση της Φ1 **και** οι λοξές ζώνες της Φ2 (ADR-929).
 * - **Τέταρτα στροφής** (90° · 180° · 270°): ακριβής μετάθεση pixel, καμία δειγματοληψία (OCR του ADR-929 Φ0.3).
 *
 * ⚠️ Το `sampleBilinear` του `spatial-tour/tileset/equirect-to-cube.ts` **δεν** είναι διπλότυπο αυτού: αναδιπλώνει το
 *   μήκος (ραφή 180° του πανοράματος) και διαβάζει N κανάλια χωρίς άλφα. Άλλο συμβόλαιο άκρων, επίτηδες.
 *
 * @module lib/geometry/raster/raster-warp
 */

import { type Affine2x3 } from '../affine-2x3';
import { homographyFromAffine, type Homography } from '../homography';
import { blankPlanRaster, type PlanRaster } from './plan-raster';

type Rgba = PlanRaster & { readonly rgba: Uint8ClampedArray };

/**
 * Ο μικρότερος ακέραιος συντελεστής του `downscaleArea` που φέρνει την εικόνα κάτω από `maxPixels` (ADR-929: εικόνα
 * εργασίας της Φ1 · εικόνα ανίχνευσης του τοπικού OCR, Φ0.6).
 */
export function workingScaleFor(width: number, height: number, maxPixels: number): number {
  return Math.max(1, Math.ceil(Math.sqrt((width * height) / Math.max(1, maxPixels))));
}

/** Μείωση με **ακέραιο** συντελεστή `factor ≥ 1`. Η τελευταία στήλη/γραμμή μετρά μόνο τα pixel που υπάρχουν. */
export function downscaleArea(src: PlanRaster, factor: number): Rgba {
  const f = Math.max(1, Math.floor(factor));
  const width = Math.ceil(src.width / f);
  const height = Math.ceil(src.height / f);
  const acc = new Float64Array(width * height * 4);
  const count = new Uint32Array(width * height);
  for (let y = 0; y < src.height; y++) {
    const row = Math.floor(y / f) * width;
    for (let x = 0; x < src.width; x++) {
      const t = row + Math.floor(x / f);
      const o = (y * src.width + x) * 4;
      for (let c = 0; c < 4; c++) acc[t * 4 + c] += src.rgba[o + c];
      count[t]++;
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let t = 0; t < width * height; t++) {
    for (let c = 0; c < 4; c++) rgba[t * 4 + c] = Math.round(acc[t * 4 + c] / count[t]);
  }
  return { rgba, width, height };
}

/**
 * Δι-γραμμική τιμή του `src` στο **συνεχές** σημείο `(x, y)`, συντεθειμένη πάνω σε λευκό. Έξω από την εικόνα κατά πάνω
 * από μισό pixel ⇒ λευκό· στο τελευταίο μισό pixel της άκρης η τιμή κρατιέται (κανένα γκρι περίγραμμα).
 */
function sampleInto(src: PlanRaster, x: number, y: number, out: Uint8ClampedArray, at: number): void {
  if (x < 0 || y < 0 || x > src.width || y > src.height) { out[at] = out[at + 1] = out[at + 2] = out[at + 3] = 255; return; }
  const fx = Math.min(src.width - 1, Math.max(0, x - 0.5));
  const fy = Math.min(src.height - 1, Math.max(0, y - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const o00 = (y0 * src.width + x0) * 4;
  const o10 = (y0 * src.width + x1) * 4;
  const o01 = (y1 * src.width + x0) * 4;
  const o11 = (y1 * src.width + x1) * 4;
  const d = src.rgba;
  const alpha = (d[o00 + 3] * w00 + d[o10 + 3] * w10 + d[o01 + 3] * w01 + d[o11 + 3] * w11) / 255;
  for (let c = 0; c < 3; c++) {
    const v = d[o00 + c] * w00 + d[o10 + c] * w10 + d[o01 + c] * w01 + d[o11 + c] * w11;
    out[at + c] = v * alpha + 255 * (1 - alpha);
  }
  out[at + 3] = 255;
}

/**
 * Για κάθε pixel εξόδου `width × height`, το συνεχές σημείο της πηγής κάτω από το κέντρο του: `visit(δείκτης, x, y)`.
 *
 * ⚡ Αριθμητής και παρονομαστής είναι **γραμμικοί** στο `x`: ανά γραμμή υπολογίζονται μία φορά και μετά αυξάνονται κατά
 *   `a`, `d`, `g` ανά pixel — καμία δέσμευση αντικειμένου στον εσωτερικό βρόχο (ίδιο αποτέλεσμα με το `applyHomography`).
 */
function forEachWarpedSample(
  outputToSource: Homography, width: number, height: number, visit: (index: number, x: number, y: number) => void,
): void {
  const m = outputToSource;
  for (let y = 0; y < height; y++) {
    const v = y + 0.5;
    let nx = m.a * 0.5 + m.b * v + m.c;
    let ny = m.d * 0.5 + m.e * v + m.f;
    let w = m.g * 0.5 + m.h * v + 1;
    for (let x = 0; x < width; x++) {
      visit(y * width + x, nx / w, ny / w);
      nx += m.a;
      ny += m.d;
      w += m.g;
    }
  }
}

/**
 * **Παραμόρφωση εικόνας**: εικόνα `width × height` όπου κάθε pixel διαβάζει την πηγή στο `outputToSource(κέντρο)`.
 * Δίνεται η ομογραφία **έξοδος → πηγή** (αντίστροφη απεικόνιση), ώστε να μη μείνουν «τρύπες» όπως με την ευθεία προβολή.
 */
export function warpHomography(src: PlanRaster, outputToSource: Homography, width: number, height: number): Rgba {
  const out = blankPlanRaster(width, height);
  forEachWarpedSample(outputToSource, width, height, (i, x, y) => sampleInto(src, x, y, out.rgba, i * 4));
  return out;
}

/** **Παραμόρφωση μάσκας** (`0/1`), πλησιέστερος γείτονας. Έξω από την πηγή ⇒ `0`. */
export function warpMask(
  mask: Uint8Array, cols: number, rows: number, outputToSource: Homography, width: number, height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  forEachWarpedSample(outputToSource, width, height, (i, x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    out[i] = mask[Math.floor(y) * cols + Math.floor(x)];
  });
  return out;
}

/** Δεξιόστροφα τέταρτα στροφής, όπως φαίνονται στην οθόνη (`y` προς τα κάτω). */
export type QuarterTurns = 1 | 2 | 3;

/**
 * **Περιστροφή κατά `turns · 90°` δεξιόστροφα** — ακριβής μετάθεση pixel, χωρίς δειγματοληψία (ό,τι το `cv2.rotate`).
 * Για γωνίες εκτός των τεταρτημορίων υπάρχει το {@link straighteningRotation}, που αναδειγματίζει.
 */
export function rotateQuarterTurns(src: PlanRaster, turns: QuarterTurns): Rgba {
  const swap = turns !== 2;
  const width = swap ? src.height : src.width;
  const height = swap ? src.width : src.height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = turns === 1 ? y : turns === 2 ? src.width - 1 - x : src.width - 1 - y;
      const sy = turns === 1 ? src.height - 1 - x : turns === 2 ? src.height - 1 - y : x;
      const o = (sy * src.width + sx) * 4;
      const t = (y * width + x) * 4;
      rgba[t] = src.rgba[o];
      rgba[t + 1] = src.rgba[o + 1];
      rgba[t + 2] = src.rgba[o + 2];
      rgba[t + 3] = src.rgba[o + 3];
    }
  }
  return { rgba, width, height };
}

export interface StraighteningRotation {
  readonly outputToInput: Homography;
  readonly width: number;
  readonly height: number;
}

/**
 * Η περιστροφή που ισιώνει ευθείες γωνίας `angleDeg` (raster-px, `+x → +y`): έξοδος → είσοδος = περιστροφή κατά `+θ`
 * γύρω από τα κέντρα. Ο καμβάς εξόδου χωρά **ολόκληρη** την περιστραμμένη εικόνα (καμία γωνία δεν κόβεται).
 */
export function straighteningRotation(width: number, height: number, angleDeg: number): StraighteningRotation {
  const t = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const outW = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin) - 1e-9);
  const outH = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos) - 1e-9);
  const ox = outW / 2;
  const oy = outH / 2;
  const affine: Affine2x3 = {
    a: cos, b: sin, c: -sin, d: cos,
    e: width / 2 - (cos * ox - sin * oy),
    f: height / 2 - (sin * ox + cos * oy),
  };
  return { outputToInput: homographyFromAffine(affine), width: outW, height: outH };
}
