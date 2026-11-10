/**
 * ADR-929 Φ0.5 — **από τα κείμενα του τοπικού OCR σε {@link PlanReading}**, το ίδιο συμβόλαιο που γεμίζει ο αναγνώστης VLM
 * (`reading/plan-reading-from-view.ts`). Η σύντηξη (Φ4) δεν ξέρει ποιος διάβασε.
 *
 * 🔑 **Πλαίσιο = σφιχτό, σε αρχικά px.** Οι κορυφές του OCR περνούν από την ομογραφία της ευθυγράμμισης μία-μία και κρατιέται
 *   το περιβάλλον ορθογώνιο (`rasterBoundsOf`): το `dimension-binding` κρίνει τη διεύθυνση από τον λόγο του κουτιού (1,25), άρα
 *   ένα κατακόρυφο κείμενο (πέρασμα 90°) πρέπει να βγαίνει ψηλό και στενό. Αν το OCR διάβασε την αρχική εικόνα, δίνεται
 *   `IDENTITY_HOMOGRAPHY`.
 * 🔑 **Μόνο ό,τι λέει το κείμενο.** Η μορφή δίνει διάσταση / κλίμακα / εμβαδό / ετικέτα ανοίγματος (`written-values`)· τα
 *   `segmentIds` μένουν κενά (η δέση με τις γραμμές είναι δουλειά της σύντηξης), και χώροι/ανοίγματα δεν προκύπτουν από
 *   κείμενο χωρίς γεωμετρία ⇒ `[]`. Ένα σκέτο ακέραιο χωρίς αποδεδειγμένη μονάδα μένει μόνο στα `texts`.
 * 🔑 **Το όνομα του μοντέλου βγαίνει από το μητρώο** (`.model-assets.json`, με τα revisions), ποτέ χειρόγραφο.
 *
 * @module bim/plan-recognition/ocr/ocr-reading
 */

import type { Homography } from '@/lib/geometry/homography';
import { alignedPointToOriginal, rasterBoundsOf } from '../alignment/alignment-region';
import type { PlanDimension, PlanReading, PlanText, PlanWrittenScale } from '../plan-recognition-types';
import { readingConfidence } from '../reading/plan-reading-from-view';
import { classifyWrittenText, inferBareIntegerUnit, parseDimensionValue, parseWrittenScale } from '../reading/written-values';
import type { OcrText } from './ocr-engine';
import type { OcrAssetSet } from './ocr-model-assets';

/** Αλλάζει όταν αλλάζει η μετατροπή κειμένων → ανάγνωση (νέα κλειδιά, ποτέ μπαγιάτικη ανάγνωση). */
export const OCR_READING_SCHEMA_VERSION = 1;

export interface OcrReadingInput {
  /** Η έξοδος του `recognizePlanText`, με τη σειρά της. */
  readonly texts: readonly OcrText[];
  /** Από τα px της εικόνας που διάβασε το OCR στα αρχικά px· `IDENTITY_HOMOGRAPHY` αν διάβασε την αρχική. */
  readonly toOriginal: Homography;
  /** `localOcrModelId(resolveOcrAssets())`. */
  readonly model: string;
}

/** Ο φάκελος του μοντέλου μέσα στη διαδρομή του (`/models/ocr/<όνομα>@<revision>/inference.onnx`). */
const modelDir = (path: string): string => path.split('/').at(-2) ?? path;

/** Η ταυτότητα της τοπικής ανάγνωσης: ανιχνευτής + αναγνώστες, με τα revisions τους. */
export function localOcrModelId(assets: OcrAssetSet): string {
  return `local-ocr:${[assets.detector, assets.primary, assets.secondary].map((m) => modelDir(m.onnx.path)).join('+')}`;
}

function toPlanTexts(texts: readonly OcrText[], toOriginal: Homography): PlanText[] {
  return texts
    .filter((t) => t.text.trim() !== '')
    .map((t, i) => ({
      id: `t${i + 1}`,
      kind: classifyWrittenText(t.text),
      raw: t.text,
      rect: rasterBoundsOf(t.polygon.map((p) => alignedPointToOriginal(p, toOriginal))),
      confidence: readingConfidence(t.recScore),
    }));
}

function dimensionsOf(texts: readonly PlanText[]): PlanDimension[] {
  const dimensionTexts = texts.filter((t) => t.kind === 'dimension');
  const bareIntegerUnit = inferBareIntegerUnit(dimensionTexts.map((t) => t.raw));
  return dimensionTexts.flatMap((t) => {
    const length = parseDimensionValue(t.raw, bareIntegerUnit);
    return length === null ? [] : [{ textId: t.id, valueMm: length.valueMm, segmentIds: [], confidence: t.confidence }];
  });
}

/** Η γραμμένη κλίμακα με τη μεγαλύτερη βεβαιότητα ανάγνωσης. */
function writtenScaleOf(texts: readonly PlanText[]): PlanWrittenScale | null {
  let best: PlanWrittenScale | null = null;
  for (const t of texts) {
    const denominator = t.kind === 'scale' ? parseWrittenScale(t.raw) : null;
    if (denominator === null || (best !== null && best.confidence.score >= t.confidence.score)) continue;
    best = { textId: t.id, denominator, confidence: t.confidence };
  }
  return best;
}

/** Τα κείμενα του OCR ⇒ μία ανάγνωση στα **αρχικά** px. Καθαρή συνάρτηση. */
export function planReadingFromOcr(input: OcrReadingInput): PlanReading {
  const texts = toPlanTexts(input.texts, input.toOriginal);
  return {
    model: input.model,
    schemaVersion: OCR_READING_SCHEMA_VERSION,
    texts,
    dimensions: dimensionsOf(texts),
    writtenScale: writtenScaleOf(texts),
    rooms: [],
    openings: [],
  };
}
