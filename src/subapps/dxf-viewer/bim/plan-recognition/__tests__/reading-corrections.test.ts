/**
 * ADR-929 Δ21 (δ) — οι διορθώσεις του ανθρώπου πάνω σε μια ανάγνωση: διόρθωση τιμής · «δεν είναι διάσταση» · επαναφορά,
 * με τον ΙΔΙΟ κανόνα μονάδων και προέλευση `correctedFrom`· και η επιβίωσή τους όταν αλλάζει η περικοπή της όψης.
 */

import { IDENTITY_HOMOGRAPHY, type Quad } from '@/lib/geometry/homography';
import type { OcrText } from '../ocr/ocr-engine';
import { planReadingFromOcr } from '../ocr/ocr-reading';
import type { PlanReading } from '../plan-recognition-types';
import {
  applyReadingCorrections, NO_READING_CORRECTIONS, withReadingCorrection, type PlanReadingCorrections,
} from '../reading/reading-corrections';

const MODEL = 'local-ocr:test';

const quad = (x: number, y: number, w: number, h: number): Quad =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

const ocr = (text: string, polygon: Quad, recScore = 0.8): OcrText =>
  ({ text, recScore, detScore: 0.8, rotation: 0, polygon, reader: 'primary' });

/** Το DOC014 σε μικρογραφία: το 4,12 διαβάστηκε 4,15 · το «μ.μ» μόνο του · «4,12 μμ» (μονάδα που δεν αποδεικνύεται). */
const TEXTS: readonly OcrText[] = [
  ocr('2.05', quad(0, 0, 40, 10)),
  ocr('4.15', quad(100, 0, 40, 10)),
  ocr('μ.μ', quad(200, 0, 20, 10)),
  ocr('4,12 μμ', quad(300, 0, 30, 10)),
];

const readingOf = (texts: readonly OcrText[] = TEXTS): PlanReading =>
  planReadingFromOcr({ texts, toOriginal: IDENTITY_HOMOGRAPHY, model: MODEL });

const correct = (
  base: PlanReadingCorrections, textId: string, correction: Parameters<typeof withReadingCorrection>[3],
): PlanReadingCorrections => withReadingCorrection(base, MODEL, textId, correction);

const dims = (r: PlanReading) => r.dimensions.map((d) => [d.textId, d.valueMm]);

describe('applyReadingCorrections — Δ21 (δ)', () => {
  it('χωρίς διορθώσεις ⇒ η ΙΔΙΑ ανάγνωση (ταυτότητα αντικειμένου)', () => {
    const r = readingOf();
    expect(applyReadingCorrections(r, NO_READING_CORRECTIONS)).toBe(r);
  });

  it('διόρθωση τιμής: νέα τιμή από τον ΙΔΙΟ κανόνα, correctedFrom = ό,τι διάβασε η μηχανή, βεβαιότητα 1', () => {
    const r = applyReadingCorrections(readingOf(), correct(NO_READING_CORRECTIONS, 't2', { kind: 'value', raw: '4,12 μ.μ.' }));
    const t2 = r.texts.find((t) => t.id === 't2');
    expect(t2).toMatchObject({ raw: '4,12 μ.μ.', kind: 'dimension', correctedFrom: '4.15', confidence: { score: 1 } });
    expect(dims(r)).toEqual([['t1', 2050], ['t2', 4120]]);
    expect(r.texts.find((t) => t.id === 't1')?.correctedFrom).toBeUndefined();
  });

  it('κείμενο που η μηχανή δεν έκανε διάσταση γίνεται διάσταση μόνο με δική του διόρθωση', () => {
    expect(dims(readingOf())).toEqual([['t1', 2050], ['t2', 4150]]);
    const r = applyReadingCorrections(readingOf(), correct(NO_READING_CORRECTIONS, 't4', { kind: 'value', raw: '4,12 μ.μ.' }));
    expect(dims(r)).toEqual([['t1', 2050], ['t2', 4150], ['t4', 4120]]);
  });

  it('«δεν είναι διάσταση»: το κείμενο μένει ορατό ως «άλλο», βγαίνει από τις διαστάσεις', () => {
    const r = applyReadingCorrections(readingOf(), correct(NO_READING_CORRECTIONS, 't2', { kind: 'not-dimension' }));
    expect(r.texts.find((t) => t.id === 't2')).toMatchObject({ raw: '4.15', kind: 'other', correctedFrom: '4.15' });
    expect(dims(r)).toEqual([['t1', 2050]]);
  });

  it('επαναφορά ⇒ ξανά η ανάγνωση της μηχανής', () => {
    const corrected = correct(NO_READING_CORRECTIONS, 't2', { kind: 'value', raw: '4.12' });
    const reverted = correct(corrected, 't2', null);
    expect(reverted.byTextId).toEqual({});
    expect(applyReadingCorrections(readingOf(), reverted)).toEqual(readingOf());
  });

  it('διορθώσεις ΑΛΛΗΣ ανάγνωσης δεν εφαρμόζονται ποτέ (τα ids δεν μιλούν για τα ίδια κείμενα)', () => {
    const other = withReadingCorrection(NO_READING_CORRECTIONS, 'gpt-x', 't2', { kind: 'value', raw: '9.99' });
    const r = readingOf();
    expect(applyReadingCorrections(r, other)).toBe(r);
    expect(withReadingCorrection(other, MODEL, 't1', { kind: 'not-dimension' }).byTextId).toEqual({ t1: { kind: 'not-dimension' } });
  });
});

describe('Δ21 (δ) — η διόρθωση επιβιώνει όταν αλλάζει η περικοπή (η παγίδα της αρίθμησης μετά το φίλτρο)', () => {
  it('ίδιο κείμενο ⇒ ίδιο id σε κάθε όψη, και η διόρθωση πέφτει στο ΙΔΙΟ κείμενο', () => {
    const corrections = correct(NO_READING_CORRECTIONS, 't2', { kind: 'value', raw: '4.12' });
    // Η όψη κόβει το πρώτο κείμενο (2.05): πριν το Δ21 το «4.15» θα γινόταν t1 και η διόρθωση θα χανόταν
    const crop = { minX: 80, minY: -10, maxX: 400, maxY: 20 };
    const cropped = planReadingFromOcr({
      texts: TEXTS, toOriginal: IDENTITY_HOMOGRAPHY, model: MODEL,
      view: { view: { crop, redacted: [] }, originalToAligned: IDENTITY_HOMOGRAPHY },
    });
    expect(cropped.texts.map((t) => [t.id, t.raw])).toEqual([['t2', '4.15'], ['t3', 'μ.μ'], ['t4', '4,12 μμ']]);
    const r = applyReadingCorrections(cropped, corrections);
    expect(r.texts.find((t) => t.id === 't2')).toMatchObject({ raw: '4.12', correctedFrom: '4.15' });
    expect(dims(r)).toEqual([['t2', 4120]]);
  });
});
