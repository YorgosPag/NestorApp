/**
 * =============================================================================
 * ΤΑΝΥΣΤΕΣ ΕΙΣΟΔΟΥ ΤΩΝ ΜΟΝΤΕΛΩΝ OCR ΚΑΙ ΚΟΨΙΜΟ ΚΟΥΤΙΟΥ (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Η προεπεξεργασία του μετρημένου Python (Φ0.1), πάνω στα υπάρχοντα SSoT εικόνας (`PlanRaster`, `warpHomography`):
 * - **Ανιχνευτής**: RGB, `/255`, κανονικοποίηση ImageNet, λευκό γέμισμα ως το επόμενο πολλαπλάσιο του 32, NCHW.
 * - **Κόψιμο**: το περιστραμμένο κουτί, με κορυφές σε σειρά ανάγνωσης, ισιώνεται σε ορθογώνιο `round(|tl→tr|) ×
 *   round(|tl→bl|)` (ομογραφία, δι-γραμμικό, λευκό έξω) — ό,τι το `cv2.warpPerspective` του `crop_rect`.
 * - **Αναγνώστης**: ύψος 48, πλάτος `ceil(48 · w / h)` στο `[8, 3200]` (δι-γραμμικό), `(x/255 − 0,5) / 0,5`, NCHW.
 *
 * 📏 Τα κουτιά έρχονται σε **δείκτες pixel** (κέντρο = ακέραιος, σύμβαση OpenCV)· το `warpHomography` δουλεύει σε
 *   **συνεχή** χώρο (κέντρο = `i + ½`). Η μετάβαση γίνεται **εδώ, μία φορά**, με μετατόπιση ½ των τετραπλεύρων — αλλιώς
 *   κάθε κόψιμο θα έφευγε μισό pixel από τη μέτρηση.
 * 🔑 **Οι εκτελεστές των μοντέλων εγχέονται** (`DetectorRunner`, `OcrRecognizer`): ο πυρήνας μένει καθαρός TS και ο worker
 *   (Φ0.4) βάζει το `onnxruntime-web`· η μέτρηση ισοδυναμίας τρέχει τον ίδιο πυρήνα σε Node.
 *
 * @module bim/plan-recognition/ocr/ocr-tensors
 */

import { homographyFromAffine, quadToQuad, rectQuad, type Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { warpHomography } from '@/lib/geometry/raster/raster-warp';
import type { ProbabilityMap } from './ocr-det-postprocess';
import type { RecognizerOutput } from './ocr-rec-decode';
import { viewPixelOffset, type OcrPass, type TileRegion } from './ocr-tiles';

/** Τανυστής `float32` σε διάταξη NCHW (`[1, 3, ύψος, πλάτος]`). */
export interface OcrTensor {
  readonly data: Float32Array;
  readonly dims: readonly [1, 3, number, number];
}

/** Εκτελεστής ανιχνευτή: τανυστής → χάρτης πιθανότητας **ίδιων** διαστάσεων με τον τανυστή (με το γέμισμα). */
export type DetectorRunner = (input: OcrTensor) => Promise<ProbabilityMap>;

/** Αναγνώστης: εκτελεστής + οι κλάσεις CTC του (`recognitionClasses`). */
export interface OcrRecognizer {
  readonly run: (input: OcrTensor) => Promise<RecognizerOutput>;
  readonly classes: readonly string[];
}

const DET_MEAN = [0.485, 0.456, 0.406] as const;
const DET_STD = [0.229, 0.224, 0.225] as const;
/** Ο ανιχνευτής DB μειώνει ×32 εσωτερικά: η είσοδος πρέπει να είναι πολλαπλάσιο. */
const DET_ALIGN = 32;

export const REC_HEIGHT = 48;
const REC_MIN_WIDTH = 8;
const REC_MAX_WIDTH = 3200;

/** Τιμή καναλιού στο `[0, 1]`, συντεθειμένη πάνω σε λευκό (μια σάρωση είναι αδιαφανής· μια διαφανής PNG όχι πάντα). */
function channel(rgba: PlanRaster['rgba'], o: number, c: number): number {
  const a = rgba[o + 3] / 255;
  return (rgba[o + c] * a + 255 * (1 - a)) / 255;
}

/** Ο τανυστής του ανιχνευτή για ένα πλακίδιο της όψης ενός περάσματος (χωρίς στραμμένο αντίγραφο της σάρωσης). */
export function detectorTensor(image: PlanRaster, pass: OcrPass, region: TileRegion): OcrTensor {
  const pw = Math.ceil(region.width / DET_ALIGN) * DET_ALIGN;
  const ph = Math.ceil(region.height / DET_ALIGN) * DET_ALIGN;
  const plane = pw * ph;
  const data = new Float32Array(3 * plane);
  for (let c = 0; c < 3; c++) data.fill((1 - DET_MEAN[c]) / DET_STD[c], c * plane, (c + 1) * plane);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const o = viewPixelOffset(image, pass, region.x + x, region.y + y);
      const at = y * pw + x;
      for (let c = 0; c < 3; c++) data[c * plane + at] = (channel(image.rgba, o, c) - DET_MEAN[c]) / DET_STD[c];
    }
  }
  return { data, dims: [1, 3, ph, pw] };
}

/** Ο χάρτης του ανιχνευτή περιορισμένος στο πλακίδιο (χωρίς το γέμισμα) — ελέγχεται ότι ο εκτελεστής τήρησε το συμβόλαιο. */
export function tileProbability(map: ProbabilityMap, input: OcrTensor, region: TileRegion): ProbabilityMap {
  if (map.height !== input.dims[2] || map.width !== input.dims[3]) {
    throw new RangeError(`ocr-tensors: detector map ${map.width}x${map.height} != input ${input.dims[3]}x${input.dims[2]}`);
  }
  return { data: map.data, width: region.width, height: region.height, stride: map.stride };
}

const toContinuous = (q: Quad): Quad => [
  { x: q[0].x + 0.5, y: q[0].y + 0.5 }, { x: q[1].x + 0.5, y: q[1].y + 0.5 },
  { x: q[2].x + 0.5, y: q[2].y + 0.5 }, { x: q[3].x + 0.5, y: q[3].y + 0.5 },
];

/**
 * Το κουτί ισιωμένο: το `quad` (σειρά ανάγνωσης, δείκτες pixel της εικόνας) → ορθογώνιο. `null` όταν το κουτί
 * εκφυλίζεται (μηδενική πλευρά) — δεν υπάρχει τίποτα να διαβαστεί.
 */
export function cropReadingQuad(image: PlanRaster, quad: Quad): PlanRaster | null {
  const [tl, tr, , bl] = quad;
  const w = Math.round(Math.hypot(tr.x - tl.x, tr.y - tl.y));
  const h = Math.round(Math.hypot(bl.x - tl.x, bl.y - tl.y));
  if (w < 1 || h < 1) return null;
  const outputToSource = quadToQuad(toContinuous(rectQuad(w, h)), toContinuous(quad));
  return outputToSource === null ? null : warpHomography(image, outputToSource, w, h);
}

/** Ο τανυστής του αναγνώστη για ένα ισιωμένο κουτί: ύψος 48, πλάτος ανάλογο, `[−1, 1]`. */
export function recognizerTensor(crop: PlanRaster): OcrTensor {
  const ratio = (REC_HEIGHT * crop.width) / Math.max(crop.height, 1);
  const width = Math.max(REC_MIN_WIDTH, Math.min(REC_MAX_WIDTH, Math.ceil(ratio)));
  const scale = homographyFromAffine({ a: crop.width / width, b: 0, c: 0, d: crop.height / REC_HEIGHT, e: 0, f: 0 });
  const resized = warpHomography(crop, scale, width, REC_HEIGHT);
  const plane = width * REC_HEIGHT;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) data[c * plane + i] = (resized.rgba[i * 4 + c] / 255 - 0.5) / 0.5;
  }
  return { data, dims: [1, 3, REC_HEIGHT, width] };
}
