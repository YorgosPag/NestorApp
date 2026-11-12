/**
 * =============================================================================
 * ΣΥΝΤΕΛΕΣΤΗΣ ΜΕΙΩΣΗΣ ΑΠΟ ΤΟ ΜΕΤΡΗΜΕΝΟ ΥΨΟΣ ΓΡΑΜΜΑΤΩΝ (ADR-929 §6.16 βήμα 3)
 * =============================================================================
 *
 * Η μεταβλητή ελέγχου του ανιχνευτή είναι το **ύψος των γραμμάτων σε px της εικόνας ανίχνευσης**, όχι τα megapixel
 * (απόφαση Giorgio, §6.16 #3· Azure Read: «ελάχιστο ύψος κειμένου»). Ροή:
 * 1. **Αδρό πέρασμα** σε συντελεστή `probeDownscaleFor` (φθηνό: λίγα πλακίδια).
 * 2. Ύψος = μικρή πλευρά κάθε κουτιού που «ταιριάζει» στο πέρασμά του, σε px της **αρχικής** εικόνας.
 * 3. Ο μεγαλύτερος ακέραιος `ds` με `pQ(ύψη) / ds ≥ minTextHeightPx`, **όχι πάνω από τον αδρό**: αν φτάσει τον αδρό, οι
 *    ανιχνεύσεις του ξαναχρησιμοποιούνται (καμία ανίχνευση δεν είναι φθηνότερη από αυτή που έγινε ήδη).
 *
 * 🔑 **Λίγα δείγματα ⇒ πλήρης ανάλυση** (`1`): χωρίς μέτρηση δεν μαντεύουμε μείωση. Η ποιότητα πάει πριν τον χρόνο.
 * 📏 Ποσοστημόριο nearest-rank από το SSoT `utils/sample-distribution` (πραγματικό δείγμα, ποτέ παρεμβολή).
 *
 * Καθαρό module: μηδέν DOM, μηδέν μοντέλα.
 *
 * @module bim/plan-recognition/ocr/ocr-scale
 */

import type { Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { workingScaleFor } from '@/lib/geometry/raster/raster-warp';
import { percentileOfSorted } from '../../../utils/sample-distribution';
import type { OcrCandidate } from './ocr-tiles';

/** Οι μετρημένες παράμετροι του κανόνα (§6.16 #5): αλλαγή εδώ = νέα μέτρηση στις εικόνες αναφοράς. */
export const OCR_SCALE = {
  /**
   * Ελάχιστο ύψος γραμμάτων (το `textHeightQuantile` των κουτιών) σε px της εικόνας ανίχνευσης.
   * Μετρημένο στην παραγωγή (§6.16 #5): η ποιότητα πέφτει κάτω από αυτό, πάνω από αυτό δεν κερδίζεται τίποτα.
   */
  minTextHeightPx: 14,
  /** Το ποσοστημόριο των υψών που πρέπει να μένει ορατό: τα μικρότερα γράμματα, όχι τα τυπικά. */
  textHeightQuantile: 0.1,
  /** Κάτω από τόσα κουτιά η μέτρηση δεν εμπιστεύεται ⇒ πλήρης ανάλυση. */
  minSamples: 20,
  /**
   * Προϋπολογισμός pixel του **αδρού** περάσματος: κόστος της μέτρησης, όχι κριτήριο ποιότητας. Η τελική ανάλυση
   * αποφασίζεται από τα γράμματα· ο αδρός δίνει μόνο το ανώτατο `ds`.
   */
  probeMaxPixels: 8_000_000,
} as const;

/** Ο συντελεστής του αδρού περάσματος: η εικόνα χωρά στον προϋπολογισμό του (`OCR_SCALE.probeMaxPixels`). */
export function probeDownscaleFor(raster: Pick<PlanRaster, 'width' | 'height'>): number {
  return workingScaleFor(raster.width, raster.height, OCR_SCALE.probeMaxPixels);
}

/** Το ύψος γραμμάτων ενός κουτιού: η μικρή πλευρά του (περιστρεμμένου) ορθογωνίου, σε px της αρχικής εικόνας. */
export function textHeightOf(polygon: Quad): number {
  const side = (i: 0 | 1): number => Math.hypot(polygon[i + 1].x - polygon[i].x, polygon[i + 1].y - polygon[i].y);
  return Math.min(side(0), side(1));
}

/** Το ύψος των μικρότερων γραμμάτων (`textHeightQuantile`) των κουτιών που ταιριάζουν· `null` με λίγα δείγματα. */
export function smallTextHeightPx(candidates: readonly OcrCandidate[]): number | null {
  const heights = candidates.filter((c) => c.fits).map((c) => textHeightOf(c.polygon)).sort((a, b) => a - b);
  if (heights.length < OCR_SCALE.minSamples) return null;
  return percentileOfSorted(heights, OCR_SCALE.textHeightQuantile);
}

/**
 * Ο τελικός συντελεστής από το ύψος γραμμάτων (`null` ⇒ `1`), στο `[1, probeDownscale]`. Ίσος με τον αδρό ⇒ οι
 * ανιχνεύσεις του αδρού ξαναχρησιμοποιούνται.
 */
export function downscaleForTextHeight(smallTextPx: number | null, probeDownscale: number): number {
  if (smallTextPx === null) return 1;
  const fit = Math.floor(smallTextPx / OCR_SCALE.minTextHeightPx);
  return Math.min(probeDownscale, Math.max(1, fit));
}
