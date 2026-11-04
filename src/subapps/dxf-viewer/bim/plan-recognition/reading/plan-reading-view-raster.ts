/**
 * Τα **pixel** της όψης (ADR-929 Δ5, Δ15 #4): η περιοχή του σχεδίου, ίσια, από την **αρχική** εικόνα, με ασπρισμένες τις
 * περιοχές που δεν πρέπει να φύγουν (πινακίδα, υπόμνημα, σφραγίδα). Μία συνάρτηση για τον πελάτη (Φ5, πριν την αποστολή)
 * **και** για το σενάριο μέτρησης, ώστε να μετριέται ό,τι πράγματι στέλνεται.
 *
 * 🔑 **Από την αρχική εικόνα, όχι από την εικόνα εργασίας της Φ1.** Η Φ1 μικραίνει μια σάρωση άδειας 200 dpi (7696 × 7200)
 * κατά 3 για να μετρήσει γεωμετρία· εκεί τα γράμματα μιας ετικέτας ανοίγματος («0.80 / 2.20») πέφτουν στα 5–6 px και δεν
 * διαβάζονται (μετρημένο, §6.4). Εδώ η όψη ξαναδειγματίζεται από τα αρχικά pixel, με την ομογραφία της Φ1 (Δ3), στη
 * **μεγαλύτερη** ανάλυση που χωρά στον προϋπολογισμό pixel του αναγνώστη. Το `view-‰` είναι κανονικοποιημένο στο crop,
 * άρα δεν αλλάζει με την ανάλυση.
 * 🔑 **Μείωση πρώτα με μέσο περιοχής, μετά παραμόρφωση.** Η δι-γραμμική δειγματοληψία μόνη της, σε μείωση πάνω από ×2,
 * θα έχανε λεπτές γραμμές (aliasing). Ο ακέραιος συντελεστής πάει στο `downscaleArea` και η ομογραφία κάνει μόνο το υπόλοιπο.
 * 🔑 Το άσπρισμα είναι **καταστροφικό** μέσα στο νέο buffer: ό,τι ασπρίζεται δεν υπάρχει στα bytes που φεύγουν.
 * 🔑 Η κωδικοποίηση (PNG) είναι θέμα πλατφόρμας (canvas στον πελάτη, sharp στη μέτρηση) και μένει εκτός.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-view-raster
 */

import { composeHomography, type Homography } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { downscaleArea, warpHomography } from '@/lib/geometry/raster/raster-warp';
import type { AlignedRectPx, PlanAlignment } from '../alignment/plan-alignment-types';
import { assertReadingView, type PlanReadingView } from './plan-reading-view';

/**
 * Ανώτατα pixel της εικόνας που στέλνεται. 24 M px ≈ 23.400 patches των 32 px: κάτω από το όριο των 30.000 που απορρίπτει
 * ο πάροχος (developers.openai.com/api/docs/guides/images-vision, 2026-11-04), με περιθώριο για το στρογγύλεμα των άκρων.
 */
export const PLAN_READING_MAX_VIEW_PIXELS = 24_000_000;
/**
 * Κάτω όριο pixel: μια μικρή κάτοψη αγγελίας (≈ 700 × 600) **μεγεθύνεται** ως εδώ. Ο αναγνώστης βλέπει την εικόνα σε
 * patches των 32 px· ένα γράμμα 5 px πέφτει σε κλάσμα patch και χάνεται. Η μεγέθυνση δεν προσθέτει πληροφορία στα pixel,
 * προσθέτει **patches ανά γράμμα** — τιμή επιλεγμένη με μέτρηση (ADR-929 §6.4).
 */
export const PLAN_READING_MIN_VIEW_PIXELS = 4_000_000;

export interface ReadingViewBudget {
  readonly maxPixels: number;
  readonly minPixels: number;
}

export const DEFAULT_READING_VIEW_BUDGET: ReadingViewBudget = {
  maxPixels: PLAN_READING_MAX_VIEW_PIXELS,
  minPixels: PLAN_READING_MIN_VIEW_PIXELS,
};

export interface ReadingViewRaster {
  readonly raster: PlanRaster;
  /** Pixel εξόδου ανά pixel της **αρχικής** εικόνας: < 1 μείωση (μεγάλη σάρωση), > 1 μεγέθυνση (μικρή αγγελία). */
  readonly scale: number;
}

type ViewAlignment = Pick<PlanAlignment, 'alignedToOriginal' | 'workingScale'>;

/** Pixel εξόδου → ευθυγραμμισμένα px: γραμμική κλίμακα πάνω στο crop. */
function outputToAligned(crop: AlignedRectPx, width: number, height: number): Homography {
  const sx = (crop.maxX - crop.minX) / width;
  const sy = (crop.maxY - crop.minY) / height;
  return { a: sx, b: 0, c: crop.minX, d: 0, e: sy, f: crop.minY, g: 0, h: 0 };
}

/** Κλίμακα της πηγής (μείωση με ακέραιο `f`): αρχικά px → px της μειωμένης. */
const shrinkBy = (f: number): Homography => ({ a: 1 / f, b: 0, c: 0, d: 0, e: 1 / f, f: 0, g: 0, h: 0 });

function redact(out: PlanRaster & { readonly rgba: Uint8ClampedArray }, view: PlanReadingView): void {
  const kx = out.width / (view.crop.maxX - view.crop.minX);
  const ky = out.height / (view.crop.maxY - view.crop.minY);
  for (const r of view.redacted) {
    // Τα μερικά pixel ασπρίζονται (προς την ασφάλεια: καλύτερα ένα pixel χαρτί παραπάνω από ένα γράμμα της πινακίδας).
    const x0 = Math.max(0, Math.floor((r.minX - view.crop.minX) * kx));
    const x1 = Math.min(out.width, Math.ceil((r.maxX - view.crop.minX) * kx));
    const y0 = Math.max(0, Math.floor((r.minY - view.crop.minY) * ky));
    const y1 = Math.min(out.height, Math.ceil((r.maxY - view.crop.minY) * ky));
    if (x1 <= x0) continue;
    for (let y = y0; y < y1; y++) out.rgba.fill(255, (y * out.width + x0) * 4, (y * out.width + x1) * 4);
  }
}

/**
 * Η εικόνα της όψης, έτοιμη για κωδικοποίηση. `original` = η **αρχική** εικόνα του υποβάθρου, η ίδια που πήρε η Φ1.
 */
export function renderReadingViewRaster(
  original: PlanRaster,
  alignment: ViewAlignment,
  view: PlanReadingView,
  budget: ReadingViewBudget = DEFAULT_READING_VIEW_BUDGET,
): ReadingViewRaster {
  assertReadingView(view);
  const nativeW = (view.crop.maxX - view.crop.minX) * alignment.workingScale;
  const nativeH = (view.crop.maxY - view.crop.minY) * alignment.workingScale;
  const area = nativeW * nativeH;
  const scale = Math.min(Math.sqrt(budget.maxPixels / area), Math.max(1, Math.sqrt(budget.minPixels / area)));
  const width = Math.max(1, Math.floor(nativeW * scale));
  const height = Math.max(1, Math.floor(nativeH * scale));
  const factor = Math.max(1, Math.floor(1 / scale));
  const source = factor > 1 ? downscaleArea(original, factor) : original;
  const toOriginal = composeHomography(alignment.alignedToOriginal, outputToAligned(view.crop, width, height));
  const toSource = toOriginal && (factor > 1 ? composeHomography(shrinkBy(factor), toOriginal) : toOriginal);
  if (!toSource) throw new Error('renderReadingViewRaster: degenerate alignment');
  const out = warpHomography(source, toSource, width, height);
  redact(out, view);
  return { raster: out, scale: width / nativeW };
}
