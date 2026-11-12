/**
 * ADR-929 Δ21 (δ) — **οι διορθώσεις του ανθρώπου πάνω σε μια ανάγνωση**, ως καθαρή μετατροπή `PlanReading → PlanReading`.
 *
 * Τέσσερις πράξεις ανά κείμενο: «διόρθωση τιμής» (ο άνθρωπος γράφει τι λέει το χαρτί) · «δεν είναι διάσταση» ·
 * «Σωστό ✓» (βήμα 3: επιβεβαίωση χωρίς αλλαγή, `PlanText.confirmed`) · «επαναφορά» (η διόρθωση σβήνεται, ισχύει πάλι η μηχανή).
 *
 * 🔑 **Ο ΙΔΙΟΣ κανόνας με τη μηχανή.** Η διορθωμένη τιμή είναι **κείμενο**, όχι αριθμός σε mm: το είδος βγαίνει από το
 *   `classifyWrittenText` και τα mm από το `writtenLengthsMm` (`written-values.ts`), όπως για κάθε αναγνώστη. Ο άνθρωπος
 *   λέει τι γράφει, την τιμή τη βγάζει ο κανόνας — καμία δεύτερη λίστα μονάδων.
 * 🔑 **Προέλευση «άνθρωπος» (Δ9)** = το `PlanText.correctedFrom` (τι διάβασε η μηχανή). Η βεβαιότητα ανάγνωσης ενός
 *   διορθωμένου κειμένου είναι 1: ο άνθρωπος κοίταξε το χαρτί.
 * 🔑 **Ανήκουν σε ΜΙΑ ανάγνωση** (`model`): τα `id` κειμένων δύο αναγνώσεων (VLM · τοπικό OCR) δεν μιλούν για το ίδιο
 *   κείμενο, άρα διορθώσεις άλλης ανάγνωσης **δεν** εφαρμόζονται ποτέ.
 * 🔑 Χωρίς διορθώσεις ⇒ η ίδια ανάγνωση (ταυτότητα αντικειμένου): καμία αλλαγή για όποιον δεν διόρθωσε τίποτα.
 * ⚠️ Μια διάσταση που η μηχανή **δεν** έδωσε (π.χ. σκέτος ακέραιος χωρίς αποδεδειγμένη μονάδα) γίνεται περιορισμός μόνο
 *   αν διορθωθεί η ίδια· τα `segmentIds` μιας διάστασης του VLM κρατιούνται, μια νέα ξεκινά χωρίς (τη δένει η σύντηξη).
 * ⚠️ Καμία μόνιμη αποθήκευση εδώ (→ Φ8): οι διορθώσεις ζουν όσο η αναγνώριση.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/reading/reading-corrections
 */

import type {
  PlanDimension, PlanReading, PlanReadingOutcome, PlanText, PlanTextKind, PlanWrittenScale,
} from '../plan-recognition-types';
import { readingConfidence } from './plan-reading-from-view';
import { classifyWrittenText, parseWrittenScale, writtenDimensions } from './written-values';

/** Η διόρθωση ενός κειμένου: νέο κείμενο όπως γράφεται στο χαρτί · «δεν είναι διάσταση» · «Σωστό ✓» (ίδιο κείμενο). */
export type PlanReadingCorrection =
  | { readonly kind: 'value'; readonly raw: string }
  | { readonly kind: 'not-dimension' }
  | { readonly kind: 'confirmed' };

export interface PlanReadingCorrections {
  /** Η ανάγνωση (`PlanReading.model`) στην οποία ανήκουν· `null` = καμία. */
  readonly model: string | null;
  readonly byTextId: Readonly<Record<string, PlanReadingCorrection>>;
}

export const NO_READING_CORRECTIONS: PlanReadingCorrections = { model: null, byTextId: {} };

/** Η βεβαιότητα ανάγνωσης ενός κειμένου που διόρθωσε ο άνθρωπος. */
const HUMAN_READING = readingConfidence(1);

/**
 * Νέο σύνολο με μία αλλαγή για την ανάγνωση `model`: `correction` ⇒ ορίζεται, `null` ⇒ επαναφορά. Διορθώσεις **άλλης**
 * ανάγνωσης δεν μεταφέρονται (δεν μιλούν για τα ίδια κείμενα).
 */
export function withReadingCorrection(
  current: PlanReadingCorrections,
  model: string,
  textId: string,
  correction: PlanReadingCorrection | null,
): PlanReadingCorrections {
  const base = current.model === model ? current.byTextId : {};
  const byTextId: Record<string, PlanReadingCorrection> = Object.fromEntries(
    Object.entries(base).filter(([id]) => id !== textId),
  );
  if (correction !== null) byTextId[textId] = correction;
  return { model, byTextId };
}

/** Οι διορθώσεις που ισχύουν για **αυτή** την ανάγνωση (κενές αν ανήκουν σε άλλη). */
function correctionsFor(reading: PlanReading, corrections: PlanReadingCorrections): ReadonlyMap<string, PlanReadingCorrection> {
  return corrections.model === reading.model ? new Map(Object.entries(corrections.byTextId)) : new Map();
}

function correctedText(text: PlanText, correction: PlanReadingCorrection | undefined): PlanText {
  if (!correction) return text;
  if (correction.kind === 'confirmed') return { ...text, confirmed: true, confidence: HUMAN_READING };
  const correctedFrom = text.correctedFrom ?? text.raw;
  if (correction.kind === 'not-dimension') return { ...text, kind: 'other', correctedFrom, confidence: HUMAN_READING };
  const raw = correction.raw.trim();
  return { ...text, raw, kind: classifyWrittenText(raw), correctedFrom, confidence: HUMAN_READING };
}

/**
 * Οι διαστάσεις μετά τις διορθώσεις: οι αρχικές (με τα `segmentIds` τους) και όσα κείμενα έγιναν διάσταση με διόρθωση,
 * με τιμές από τον ΕΝΑ κανόνα σε **ένα** σύνολο (η μονάδα των σκέτων ακεραίων κρίνεται μία φορά).
 */
function correctedDimensions(
  reading: PlanReading,
  texts: readonly PlanText[],
  corrections: ReadonlyMap<string, PlanReadingCorrection>,
): PlanDimension[] {
  const byId = new Map(texts.map((t) => [t.id, t]));
  const original = new Map(reading.dimensions.map((d) => [d.textId, d]));
  const added = texts.filter((t) => corrections.has(t.id) && !original.has(t.id)).map((t) => t.id);
  const candidates = [...reading.dimensions.map((d) => d.textId), ...added]
    .map((id) => byId.get(id))
    .filter((t): t is PlanText => t !== undefined && t.kind === 'dimension');
  return writtenDimensions(candidates.map((t) => {
    const before = original.get(t.id);
    const confidence = corrections.has(t.id) || !before ? t.confidence : before.confidence;
    return { textId: t.id, raw: t.raw, segmentIds: before?.segmentIds ?? [], confidence };
  }));
}

/** Η γραμμένη κλίμακα: ίδια αν το κείμενό της δεν διορθώθηκε· αλλιώς από το διορθωμένο κείμενο, ή καμία. */
function correctedWrittenScale(
  scale: PlanWrittenScale | null,
  texts: readonly PlanText[],
  corrections: ReadonlyMap<string, PlanReadingCorrection>,
): PlanWrittenScale | null {
  if (scale === null || !corrections.has(scale.textId)) return scale;
  const text = texts.find((t) => t.id === scale.textId);
  const denominator = text?.kind === 'scale' ? parseWrittenScale(text.raw) : null;
  return text && denominator !== null ? { textId: text.id, denominator, confidence: text.confidence } : null;
}

/** Η ανάγνωση με τις διορθώσεις του ανθρώπου. Χωρίς διορθώσεις για αυτήν ⇒ η **ίδια** ανάγνωση. Καθαρή συνάρτηση. */
export function applyReadingCorrections(reading: PlanReading, corrections: PlanReadingCorrections): PlanReading {
  const active = correctionsFor(reading, corrections);
  if (active.size === 0) return reading;
  const texts = reading.texts.map((t) => correctedText(t, active.get(t.id)));
  return {
    ...reading,
    texts,
    dimensions: correctedDimensions(reading, texts, active),
    writtenScale: correctedWrittenScale(reading.writtenScale, texts, active),
  };
}

/**
 * Η διόρθωση που **πραγματικά** ζητείται για ένα κείμενο της μηχανής: τιμή ίση με ό,τι διάβασε η μηχανή ⇒ καμία
 * (επαναφορά). Ένα σημείο για τον ελεγκτή και την προεπισκόπηση.
 */
export function effectiveReadingCorrection(
  machine: PlanText,
  requested: PlanReadingCorrection | null,
): PlanReadingCorrection | null {
  return requested?.kind === 'value' && requested.raw.trim() === machine.raw.trim() ? null : requested;
}

/** Τι θα γίνει ένα κείμενο με μια διόρθωση: είδος, και τιμή σε mm αν θα γίνει περιορισμός του λύτη. */
export interface PlanCorrectionPreview {
  readonly kind: PlanTextKind;
  readonly valueMm: number | null;
}

/**
 * ADR-929 Δ21 (δ) βήμα 5 — **ζωντανή ερμηνεία πριν από το Enter**: τι θα γινόταν το κείμενο `textId` αν ο άνθρωπος
 * αποθήκευε τώρα το `raw`. Περνά από τον **ΙΔΙΟ** δρόμο με την αποθήκευση (`withReadingCorrection` +
 * `applyReadingCorrections`), άρα και η μονάδα των σκέτων ακεραίων κρίνεται από **όλο** το σχέδιο, όχι από το πεδίο μόνο.
 * `reading` = η ανάγνωση της **μηχανής**. Κενό κείμενο ή άγνωστο `textId` ⇒ `null`.
 */
export function previewReadingCorrection(
  reading: PlanReading,
  corrections: PlanReadingCorrections,
  textId: string,
  raw: string,
): PlanCorrectionPreview | null {
  const machine = reading.texts.find((t) => t.id === textId);
  if (!machine || raw.trim() === '') return null;
  const correction = effectiveReadingCorrection(machine, { kind: 'value', raw: raw.trim() });
  const corrected = applyReadingCorrections(reading, withReadingCorrection(corrections, reading.model, textId, correction));
  const text = corrected.texts.find((t) => t.id === textId) ?? machine;
  return { kind: text.kind, valueMm: corrected.dimensions.find((d) => d.textId === textId)?.valueMm ?? null };
}

/** Το ίδιο, για το αποτέλεσμα μιας ανάγνωσης (χωρίς ανάγνωση ⇒ ίδιο). */
export function applyReadingCorrectionsToOutcome(
  outcome: PlanReadingOutcome | null,
  corrections: PlanReadingCorrections,
): PlanReadingOutcome | null {
  if (outcome?.status !== 'read') return outcome;
  const reading = applyReadingCorrections(outcome.reading, corrections);
  return reading === outcome.reading ? outcome : { status: 'read', reading };
}
