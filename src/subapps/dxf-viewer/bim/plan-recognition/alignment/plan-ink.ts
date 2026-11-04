/**
 * Καθαρισμός εικόνας και οι **δύο δυαδοποιήσεις** του Δ14 (ADR-929 Φ1): σάρωση και κάτοψη αγγελίας.
 *
 * 🔑 **Σάρωση (β/δ):** flat-field ανά κανάλι (`normalizeBackground`, μέθοδος Leptonica) ⇒ το κίτρινο, η σκιά της
 *   δίπλωσης και ο ανομοιόμορφος φωτισμός γίνονται λευκό χαρτί. Μελάνι = **ολικό** κατώφλι Otsu (κρατά γεμάτο τον
 *   παχύ τοίχο poché, όπου το τοπικό παράθυρο «αδειάζει») **ή** τοπικό Sauvola (πιάνει το ξεθωριασμένο μολύβι που το
 *   ολικό χάνει). Ο καθένας καλύπτει το τυφλό σημείο του άλλου (σχόλιο του `adaptive-threshold.ts`).
 * 🔑 **Αγγελία (γ):** η εικόνα είναι ψηφιακή, ο φωτισμός σωστός, και τα **χρώματα των χώρων είναι πληροφορία** (το VLM
 *   διαβάζει καλύτερα το «Σαλόνι» πάνω στο μπεζ του). Γι' αυτό μόνο **ολική** λευκή ισορροπία, όχι flat-field, που θα
 *   έκανε λευκό κάθε δωμάτιο μεγαλύτερο από πλακίδιο. Μελάνι = σκούρο **και ουδέτερο**: το κανάλι «σκοτεινότητας» είναι
 *   `γκρι + 1,5 · χρώμα`, άρα το ξύλινο δάπεδο (γκρι ≈ 147, χρώμα ≈ 90) πάει στο χαρτί και ο μαύρος τοίχος μένει μελάνι.
 * 🔑 **Αυτόματη επιλογή με μέτρηση, όχι με όνομα αρχείου:** ποσοστό έντονα χρωματιστών pixel **μετά** από ολική λευκή
 *   ισορροπία. Μια κιτρινισμένη σάρωση γίνεται ουδέτερη από τη λευκή ισορροπία και **δεν** διαβάζεται ως αγγελία.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-ink
 */

import { adaptiveInkMask, DEFAULT_SAUVOLA, type AdaptiveThresholdOptions } from '@/lib/geometry/raster/adaptive-threshold';
import { normalizeBackground } from '@/lib/geometry/raster/background-normalize';
import { grayHistogram, histogramPercentile, otsuThreshold, rgbaToGray } from '@/lib/geometry/raster/otsu-threshold';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { PlanBinarization } from './plan-alignment-types';

type Rgba = PlanRaster & { readonly rgba: Uint8ClampedArray };

/** Χρώμα (max − min των RGB) πάνω από το οποίο ένα pixel λέγεται «έντονα χρωματιστό». */
const CHROMATIC = 48;
/** Ποσοστό χρωματιστών pixel πάνω από το οποίο η εικόνα είναι κάτοψη αγγελίας. */
const LISTING_FRACTION = 0.08;
/** Βάρος του χρώματος στο κανάλι σκοτεινότητας της αγγελίας. */
const CHROMA_WEIGHT = 1.5;
/** Το φωτεινό εκατοστημόριο που λέγεται «χαρτί» στη λευκή ισορροπία. */
const PAPER_PERCENTILE = 0.9;

/** Ανά κανάλι, το φωτεινό εκατοστημόριο ολόκληρης της εικόνας: το χρώμα του χαρτιού. */
function paperColour(src: PlanRaster): readonly [number, number, number] {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const n = src.width * src.height;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) hist[c][src.rgba[i * 4 + c]]++;
  const at = (h: Uint32Array) => Math.max(1, histogramPercentile(h, PAPER_PERCENTILE) ?? 255);
  return [at(hist[0]), at(hist[1]), at(hist[2])];
}

/** **Ολική λευκή ισορροπία**: κάθε κανάλι πολλαπλασιάζεται ώστε το χαρτί να γίνει 255. */
export function whiteBalance(src: PlanRaster): Rgba {
  const paper = paperColour(src);
  const out = new Uint8ClampedArray(src.width * src.height * 4);
  for (let i = 0; i < src.width * src.height; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = (src.rgba[i * 4 + c] * 255) / paper[c];
    out[i * 4 + 3] = src.rgba[i * 4 + 3];
  }
  return { rgba: out, width: src.width, height: src.height };
}

/** Ποσοστό έντονα χρωματιστών pixel μετά από λευκή ισορροπία. */
export function colourfulFraction(src: PlanRaster): number {
  const paper = paperColour(src);
  const n = src.width * src.height;
  if (n === 0) return 0;
  let colourful = 0;
  for (let i = 0; i < n; i++) {
    const r = (src.rgba[i * 4] * 255) / paper[0];
    const g = (src.rgba[i * 4 + 1] * 255) / paper[1];
    const b = (src.rgba[i * 4 + 2] * 255) / paper[2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > CHROMATIC) colourful++;
  }
  return colourful / n;
}

export function resolveBinarization(src: PlanRaster, requested: PlanBinarization | 'auto'): PlanBinarization {
  if (requested !== 'auto') return requested;
  return colourfulFraction(src) > LISTING_FRACTION ? 'listing' : 'scan';
}

/** Η καθαρή εικόνα που βλέπουν ο άνθρωπος, το VLM και η Φ2. */
export function cleanPlanImage(src: PlanRaster, mode: PlanBinarization): Rgba {
  return mode === 'scan' ? normalizeBackground(src) : whiteBalance(src);
}

/** Το κανάλι «σκοτεινότητας» 0–255: γκρι για σάρωση, γκρι + βάρος χρώματος για αγγελία. */
function darkness(clean: PlanRaster, mode: PlanBinarization): Uint8Array {
  const n = clean.width * clean.height;
  const gray = rgbaToGray(clean.rgba, n);
  if (mode === 'scan') return gray;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const chroma = Math.max(clean.rgba[o], clean.rgba[o + 1], clean.rgba[o + 2]) - Math.min(clean.rgba[o], clean.rgba[o + 1], clean.rgba[o + 2]);
    gray[i] = Math.min(255, gray[i] + CHROMA_WEIGHT * chroma);
  }
  return gray;
}

/**
 * Πάνω από αυτό το ολικό κατώφλι **δεν** εμπιστευόμαστε το Otsu: σε σχεδόν λευκό χαρτί (καθόλου ή ελάχιστο μελάνι) το
 * Otsu χωρίζει τον **θόρυβο** του χαρτιού στα δύο (π.χ. 242) και θα ονόμαζε μελάνι τη μισή εικόνα. Τότε μένει μόνο το
 * τοπικό Sauvola, που σε επίπεδο χαρτί δεν βγάζει μελάνι.
 */
const GLOBAL_INK_CEILING = 192;

/** **Μάσκα μελανιού** (`1` = μελάνι) μιας καθαρής εικόνας: ολικό Otsu **ή** τοπικό Sauvola. */
export function planInkMask(clean: PlanRaster, mode: PlanBinarization, local: AdaptiveThresholdOptions = DEFAULT_SAUVOLA): Uint8Array {
  const { width, height } = clean;
  const dark = darkness(clean, mode);
  const global = otsuThreshold(grayHistogram(dark));
  const ink = adaptiveInkMask(dark, width, height, local);
  if (global >= 0 && global <= GLOBAL_INK_CEILING) for (let i = 0; i < ink.length; i++) if (dark[i] <= global) ink[i] = 1;
  return ink;
}
