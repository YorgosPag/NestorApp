/**
 * =============================================================================
 * ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΚΟΥΤΙΟΥ ΚΑΤΑ ΤΗΝ ΑΝΑΓΝΩΣΗ (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Ένα ισιωμένο κουτί μπορεί να είναι ανάποδα ή όρθιο-κατακόρυφο. Όπως το μετρημένο `read_box` (Φ0.1), δοκιμάζονται οι
 * εύλογες περιστροφές και κρατιέται η ανάγνωση με τη **μεγαλύτερη βαθμολογία** (πρώτη σε ισοπαλία):
 * - όπως είναι, αν είναι πλατύ (`w ≥ h`)·
 * - ±90°, αν **δεν** είναι σαφώς πλατύ (`h > 0,8 · w`)·
 * - 180°, αν είναι πλατύ.
 *
 * 🔑 Οι τανυστές φτιάχνονται **μία φορά ανά κουτί** και μοιράζονται σε όλους τους αναγνώστες (ίδια προεπεξεργασία)·
 *   ο δεύτερος αναγνώστης δεν ξανακόβει ούτε ξανακλιμακώνει.
 * 📏 Οι περιστροφές είναι ακριβείς μεταθέσεις pixel (`rotateQuarterTurns`), όπως το `cv2.rotate`.
 *
 * @module bim/plan-recognition/ocr/ocr-orientation
 */

import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { rotateQuarterTurns } from '@/lib/geometry/raster/raster-warp';
import { decodeCtc, type DecodedText } from './ocr-rec-decode';
import { recognizerTensor, type OcrRecognizer, type OcrTensor } from './ocr-tensors';

/** Κάτω από αυτόν τον λόγο `h / w` ένα κουτί θεωρείται σαφώς πλατύ και δεν δοκιμάζεται κατακόρυφα. */
const UPRIGHT_TRIAL_RATIO = 0.8;

/** Οι εκδοχές του κουτιού προς δοκιμή, με τη σειρά της μέτρησης (η σειρά κρίνει τις ισοπαλίες). */
export function orientationTrials(crop: PlanRaster): PlanRaster[] {
  const wide = crop.width >= crop.height;
  const trials: PlanRaster[] = wide ? [crop] : [];
  if (crop.height > crop.width * UPRIGHT_TRIAL_RATIO) trials.push(rotateQuarterTurns(crop, 1), rotateQuarterTurns(crop, 3));
  if (wide) trials.push(rotateQuarterTurns(crop, 2));
  return trials;
}

/** Οι τανυστές των δοκιμών ενός κουτιού — κοινοί για όλους τους αναγνώστες. */
export function orientationTensors(crop: PlanRaster): OcrTensor[] {
  return orientationTrials(crop).map(recognizerTensor);
}

/** Η καλύτερη ανάγνωση ενός αναγνώστη πάνω στις δοκιμές (σειριακά: ο εκτελεστής μπορεί να είναι μία συνεδρία). */
export async function readBestOrientation(tensors: readonly OcrTensor[], recognizer: OcrRecognizer): Promise<DecodedText> {
  let best: DecodedText = { text: '', score: 0 };
  let first = true;
  for (const t of tensors) {
    const read = decodeCtc(await recognizer.run(t), recognizer.classes);
    if (first || read.score > best.score) best = read;
    first = false;
  }
  return best;
}
