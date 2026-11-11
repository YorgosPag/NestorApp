/**
 * =============================================================================
 * ΚΙΝΗΤΗΡΑΣ OCR ΚΑΤΟΨΗΣ — ΕΝΟΡΧΗΣΤΡΩΣΗ (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Σάρωση → κείμενα με κουτιά, η μετρημένη ροή του `ocr_onnx.py` (Φ0.1 + (α) της Φ0.1δ):
 * 1. μείωση με ακέραιο συντελεστή (`downscaleArea`, = `INTER_AREA`)·
 * 2. για κάθε πέρασμα (όρθιο · 90° αριστερόστροφα): πλακίδια → ανιχνευτής → `detectBoxes` → NMS ανά πέρασμα·
 * 3. (α) διπλά πριν την ανάγνωση·
 * 4. ανάγνωση κάθε κουτιού (κόψιμο → δοκιμές προσανατολισμού → αναγνώστης, με **δρομολόγηση κατά γραφή**)·
 * 5. συγχώνευση των περασμάτων.
 *
 * 🔑 **Ανίχνευση στη μειωμένη, ανάγνωση στην ΑΡΧΙΚΗ** (ADR-929 §6.16 βήμα 2): η μείωση υπάρχει για τον χρόνο του
 *   ανιχνευτή· το κόψιμο του αναγνώστη γίνεται από την αρχική εικόνα, ώστε ένα κείμενο 20 px να μη διαβάζεται ως 10 px
 *   ξαναμεγεθυμένα σε 48. ⚠️ Απόκλιση από το Python της Φ0.1 (εκείνο έκοβε από τη μειωμένη) — μετρημένη στην παραγωγή.
 *
 * 🔑 **Δρομολόγηση κατά γραφή** (πρότυπο script-ID του Google Vision): ο δεύτερος (ελληνικός) αναγνώστης τρέχει ΜΟΝΟ
 *   όταν ο πρώτος βρήκε γράμμα (οποιουδήποτε αλφαβήτου) ή τίποτα — οι καθαροί αριθμοί («2.35») δεν ξαναδιαβάζονται — και
 *   η ανάγνωσή του κρατιέται ΜΟΝΟ αν βγάλει ελληνικό γράμμα. Μετρημένο στη Φ0.1 (v6dual): ίδια βαθμολογία, μισές κλήσεις.
 * 🔑 **Οι εκτελεστές εγχέονται** (`OcrModels`): καμία εξάρτηση από `onnxruntime` εδώ. Ακύρωση ανάμεσα σε κάθε κλήση
 *   μοντέλου (`AbortSignal`), πρόοδος ανά στάδιο.
 * 📏 Έξοδος σε **συνεχή raster-px της αρχικής εικόνας** (ADR-794), κορυφές με σειρά ανάγνωσης.
 *
 * @module bim/plan-recognition/ocr/ocr-engine
 */

import type { Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { downscaleArea } from '@/lib/geometry/raster/raster-warp';
import { detectBoxes } from './ocr-det-postprocess';
import type { DbThresholds } from './ocr-model-config';
import { orientationTensors, readBestOrientation } from './ocr-orientation';
import type { DecodedText } from './ocr-rec-decode';
import {
  cropReadingQuad, detectorTensor, tileProbability, type DetectorRunner, type OcrRecognizer, type OcrTensor,
} from './ocr-tensors';
import {
  dropUnfitDuplicates, mergePasses, OCR_PASSES, passViewSize, suppressWithinPass, tileRegions, toCandidate,
  type Box, type OcrCandidate, type OcrPass, type TileRegion,
} from './ocr-tiles';

export interface OcrModels {
  readonly detect: DetectorRunner;
  /** Τα κατώφλια DB του ανιχνευτή (`parseDbThresholds` του `inference.yml` του). */
  readonly db: DbThresholds;
  readonly primary: OcrRecognizer;
  /** Δεύτερος αναγνώστης (ελληνικός), με δρομολόγηση κατά γραφή. */
  readonly secondary?: OcrRecognizer;
}

export interface OcrProgress {
  readonly stage: 'detect' | 'read';
  readonly done: number;
  readonly total: number;
}

export interface OcrEngineOptions {
  /** Ακέραιος συντελεστής μείωσης πριν την ανίχνευση (`1` = πλήρης ανάλυση, `2` = μισή). */
  readonly downscale: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: OcrProgress) => void;
}

export type OcrReader = 'primary' | 'secondary';

/** Ένα αναγνωσμένο κουτί κειμένου. */
export interface OcrText {
  readonly text: string;
  readonly recScore: number;
  readonly detScore: number;
  /** Το πέρασμα που το βρήκε: `0` όρθιο, `90` κατακόρυφο (διαβάζεται από κάτω προς τα πάνω). */
  readonly rotation: 0 | 90;
  /** Κορυφές με σειρά ανάγνωσης, σε συνεχή raster-px της αρχικής εικόνας. */
  readonly polygon: Quad;
  readonly reader: OcrReader;
}

interface OcrRead extends DecodedText {
  readonly reader: OcrReader;
}

interface CandidateRead {
  readonly candidate: OcrCandidate;
  readonly read: OcrRead;
  readonly pass: OcrPass;
  readonly bbox: Box;
  readonly fits: boolean;
  readonly recScore: number;
}

const ANY_LETTER = /\p{L}/u;
/** Το ίδιο εύρος με τη μέτρηση: `Α…ω` και `Ά…Ώ`. */
const GREEK_LETTER = /[Α-ωΆ-Ώ]/u;

function checkDownscale(downscale: number): void {
  if (!Number.isInteger(downscale) || downscale < 1) throw new RangeError(`ocr-engine: downscale ${downscale} must be an integer >= 1`);
}

/** Ένα πέρασμα ανίχνευσης: όλα τα πλακίδια της όψης του, και NMS. */
async function detectPass(
  image: PlanRaster, pass: OcrPass, tiles: readonly TileRegion[], models: OcrModels, options: OcrEngineOptions,
  tick: () => void,
): Promise<OcrCandidate[]> {
  const found: OcrCandidate[] = [];
  for (const tile of tiles) {
    options.signal?.throwIfAborted();
    const input = detectorTensor(image, pass, tile);
    const map = tileProbability(await models.detect(input), input, tile);
    for (const box of detectBoxes(map, models.db)) found.push(toCandidate(box, tile, pass, image.width, options.downscale));
    tick();
  }
  return suppressWithinPass(found);
}

/** Όλα τα περάσματα, με πρόοδο πάνω στο συνολικό πλήθος πλακιδίων. */
async function detectAll(image: PlanRaster, models: OcrModels, options: OcrEngineOptions): Promise<OcrCandidate[]> {
  const grids = OCR_PASSES.map((pass) => {
    const view = passViewSize(image, pass);
    return { pass, tiles: tileRegions(view.width, view.height) };
  });
  const total = grids.reduce((n, g) => n + g.tiles.length, 0);
  let done = 0;
  const tick = (): void => { done++; options.onProgress?.({ stage: 'detect', done, total }); };
  const out: OcrCandidate[] = [];
  for (const g of grids) out.push(...(await detectPass(image, g.pass, g.tiles, models, options, tick)));
  return out;
}

/** Δρομολόγηση κατά γραφή (βλ. κεφαλίδα). */
async function readRouted(tensors: readonly OcrTensor[], models: OcrModels, signal?: AbortSignal): Promise<OcrRead> {
  const first = await readBestOrientation(tensors, models.primary);
  if (models.secondary === undefined) return { ...first, reader: 'primary' };
  if (first.text.trim() !== '' && !ANY_LETTER.test(first.text)) return { ...first, reader: 'primary' };
  signal?.throwIfAborted();
  const second = await readBestOrientation(tensors, models.secondary);
  return GREEK_LETTER.test(second.text) ? { ...second, reader: 'secondary' } : { ...first, reader: 'primary' };
}

/** Ανάγνωση ενός υποψηφίου: κόψιμο από την **αρχική** εικόνα (`cropQuad` σε δείκτες της αρχικής). */
async function readCandidate(source: PlanRaster, c: OcrCandidate, models: OcrModels, signal?: AbortSignal): Promise<OcrRead> {
  signal?.throwIfAborted();
  const crop = cropReadingQuad(source, c.cropQuad);
  if (crop === null) return { text: '', score: 0, reader: 'primary' };
  return readRouted(orientationTensors(crop), models, signal);
}

function toText(r: CandidateRead): OcrText {
  return {
    text: r.read.text, recScore: r.read.score, detScore: r.candidate.detScore,
    rotation: r.pass === 0 ? 0 : 90, polygon: r.candidate.polygon, reader: r.read.reader,
  };
}

/** Τα κείμενα μιας σάρωσης κάτοψης. Ρίχνει `AbortError` αν ακυρωθεί. */
export async function recognizePlanText(source: PlanRaster, models: OcrModels, options: OcrEngineOptions): Promise<OcrText[]> {
  checkDownscale(options.downscale);
  const image = options.downscale === 1 ? source : downscaleArea(source, options.downscale);
  const candidates = dropUnfitDuplicates(await detectAll(image, models, options));
  const reads: CandidateRead[] = [];
  for (const candidate of candidates) {
    const read = await readCandidate(source, candidate, models, options.signal);
    reads.push({ candidate, read, pass: candidate.pass, bbox: candidate.bbox, fits: candidate.fits, recScore: read.score });
    options.onProgress?.({ stage: 'read', done: reads.length, total: candidates.length });
  }
  return mergePasses(reads).map(toText);
}
