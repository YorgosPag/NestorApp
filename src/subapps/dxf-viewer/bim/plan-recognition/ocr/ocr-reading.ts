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
 * 🔑 **Το όνομα του μοντέλου βγαίνει από το μητρώο** (`.model-assets.json`, με τα revisions), ποτέ χειρόγραφο· το πρόθεμά
 *   του είναι η **προέλευση** (Δ9) που ξεχωρίζει την τοπική ανάγνωση από του VLM (`isLocalOcrOutcome`).
 * 🔑 ADR-929 Φ0.6 — **ακολουθεί την όψη**: μετρούν μόνο τα κείμενα που το κέντρο τους πέφτει στην όψη του ανθρώπου
 *   (`ocrTextsInView`, ο ΙΔΙΟΣ κανόνας με τα τμήματα — `isInReadingView`). Η ανάγνωση ξαναπαράγεται, δεν σβήνεται.
 * 🔑 ADR-929 Δ21 (δ) — **η ταυτότητα ενός κειμένου δεν εξαρτάται από την όψη**: το `t<N>` είναι η θέση του στην **πλήρη**
 *   έξοδο του OCR (χωρίς τα κενά), και το φίλτρο της όψης εφαρμόζεται **μετά**. Αλλιώς μια αλλαγή περικοπής θα αριθμούσε
 *   ξανά τα κείμενα και μια διόρθωση του ανθρώπου θα έπεφτε σε άλλο κείμενο.
 *
 * @module bim/plan-recognition/ocr/ocr-reading
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import { alignedPointToOriginal, rasterBoundsOf } from '../alignment/alignment-region';
import type { PlanDimension, PlanReading, PlanReadingOutcome, PlanText, PlanWrittenScale } from '../plan-recognition-types';
import { readingConfidence } from '../reading/plan-reading-from-view';
import { isInReadingView, type PlanReadingView } from '../reading/plan-reading-view';
import { classifyWrittenText, parseWrittenScale, writtenDimensions } from '../reading/written-values';
import type { OcrText } from './ocr-engine';
import type { OcrAssetSet } from './ocr-model-assets';

/** Αλλάζει όταν αλλάζει η μετατροπή κειμένων → ανάγνωση (νέα κλειδιά, ποτέ μπαγιάτικη ανάγνωση). */
export const OCR_READING_SCHEMA_VERSION = 1;

/** Το πρόθεμα της ταυτότητας κάθε τοπικής ανάγνωσης — η προέλευση (Δ9), σε ΕΝΑ σημείο. */
const LOCAL_OCR_MODEL_PREFIX = 'local-ocr:';

export interface OcrReadingInput {
  /** Η έξοδος του `recognizePlanText`, με τη σειρά της. */
  readonly texts: readonly OcrText[];
  /** Από τα px της εικόνας που διάβασε το OCR στα αρχικά px· `IDENTITY_HOMOGRAPHY` αν διάβασε την αρχική. */
  readonly toOriginal: Homography;
  /** `localOcrModelId(resolveOcrAssets())`. */
  readonly model: string;
  /** Φ0.6 — η όψη του ανθρώπου· λείπει ⇒ όλα τα κείμενα. Το φίλτρο μπαίνει **μετά** την αρίθμηση (Δ21 (δ)). */
  readonly view?: OcrReadingViewFilter;
}

/** Η όψη (crop + απόκρυψη) και η ομογραφία αρχικά → ευθυγραμμισμένα px με την οποία κρίνεται. */
export interface OcrReadingViewFilter {
  readonly view: PlanReadingView | undefined;
  readonly originalToAligned: Homography;
}

/** Ο φάκελος του μοντέλου μέσα στη διαδρομή του (`/models/ocr/<όνομα>@<revision>/inference.onnx`). */
const modelDir = (path: string): string => path.split('/').at(-2) ?? path;

/** Η ταυτότητα της τοπικής ανάγνωσης: ανιχνευτής + αναγνώστες, με τα revisions τους. */
export function localOcrModelId(assets: OcrAssetSet): string {
  const dirs = [assets.detector, assets.primary, assets.secondary].map((m) => modelDir(m.onnx.path));
  return `${LOCAL_OCR_MODEL_PREFIX}${dirs.join('+')}`;
}

/** Η ανάγνωση στη σύντηξη είναι του τοπικού OCR (όχι του VLM); */
export function isLocalOcrOutcome(outcome: PlanReadingOutcome | null): boolean {
  return outcome?.status === 'read' && outcome.reading.model.startsWith(LOCAL_OCR_MODEL_PREFIX);
}

/**
 * ADR-929 §6.16 βήμα 4 — τα κείμενα από τα px της εικόνας που διάβασε το OCR στα px των `naturalBounds`
 * (`RecognitionRaster.naturalPerRasterPx`). Ομοιόμορφη κλίμακα με αρχή την πάνω-αριστερή γωνία (συνεχή px). `1` ⇒ ίδια.
 */
export function ocrTextsToNatural(texts: readonly OcrText[], naturalPerRasterPx: number): readonly OcrText[] {
  if (naturalPerRasterPx === 1) return texts;
  const k = naturalPerRasterPx;
  return texts.map((t) => ({
    ...t,
    polygon: [
      { x: t.polygon[0].x * k, y: t.polygon[0].y * k }, { x: t.polygon[1].x * k, y: t.polygon[1].y * k },
      { x: t.polygon[2].x * k, y: t.polygon[2].y * k }, { x: t.polygon[3].x * k, y: t.polygon[3].y * k },
    ],
  }));
}

function centreOf(polygon: readonly PlanePoint[]): PlanePoint {
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

/**
 * Τα κείμενα που **μετρούν** στην όψη του ανθρώπου: το κέντρο τους (αρχικά px → ευθυγραμμισμένα) μέσα στο crop και έξω από
 * κάθε περιοχή απόκρυψης. Χωρίς όψη (`undefined`) ⇒ όλα, όπως τα τμήματα της αρχικής εξαγωγής.
 */
export function ocrTextsInView(
  texts: readonly OcrText[],
  view: PlanReadingView | undefined,
  originalToAligned: Homography,
): readonly OcrText[] {
  if (!view) return texts;
  return texts.filter((t) => {
    const c = centreOf(t.polygon);
    return isInReadingView(view, applyHomography(originalToAligned, c.x, c.y));
  });
}

/** Αριθμεί στην πλήρη λίστα (χωρίς κενά), κρατά όσα είναι στην όψη: ίδιο κείμενο ⇒ ίδιο `id` σε κάθε όψη. */
function toPlanTexts(input: OcrReadingInput): PlanText[] {
  const numbered = input.texts.filter((t) => t.text.trim() !== '');
  const { view } = input;
  const inView = view ? new Set(ocrTextsInView(numbered, view.view, view.originalToAligned)) : null;
  return numbered.flatMap((t, i) => (inView !== null && !inView.has(t) ? [] : [{
    id: `t${i + 1}`,
    kind: classifyWrittenText(t.text),
    raw: t.text,
    rect: rasterBoundsOf(t.polygon.map((p) => alignedPointToOriginal(p, input.toOriginal))),
    confidence: readingConfidence(t.recScore),
  }]));
}

/** Υποψήφια = κάθε κείμενο με μορφή διάστασης· τα τμήματα τα δένει η σύντηξη ⇒ κενά. */
function dimensionsOf(texts: readonly PlanText[]): PlanDimension[] {
  return writtenDimensions(texts
    .filter((t) => t.kind === 'dimension')
    .map((t) => ({ textId: t.id, raw: t.raw, segmentIds: [], confidence: t.confidence })));
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
  const texts = toPlanTexts(input);
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
