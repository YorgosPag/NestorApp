/**
 * ADR-929 Φ0.5 — κείμενα του τοπικού OCR ⇒ `PlanReading`: πλαίσιο σε αρχικά px, είδος από τη μορφή, μονάδα ανά σχέδιο,
 * κλίμακα, ταυτότητα μοντέλου από το μητρώο.
 */

import { IDENTITY_HOMOGRAPHY, type Homography, type Quad } from '@/lib/geometry/homography';
import type { OcrText } from '../ocr/ocr-engine';
import {
  isLocalOcrOutcome, localOcrModelId, ocrTextsInView, OCR_READING_SCHEMA_VERSION, planReadingFromOcr,
} from '../ocr/ocr-reading';
import type { PlanReadingOutcome } from '../plan-recognition-types';
import type { PlanReadingView } from '../reading/plan-reading-view';
import type { OcrAssetSet } from '../ocr/ocr-model-assets';

const quad = (x: number, y: number, w: number, h: number): Quad =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

const ocr = (text: string, polygon: Quad, recScore = 0.9, rotation: 0 | 90 = 0): OcrText =>
  ({ text, recScore, detScore: 0.8, rotation, polygon, reader: 'primary' });

const read = (texts: readonly OcrText[], toOriginal: Homography = IDENTITY_HOMOGRAPHY) =>
  planReadingFromOcr({ texts, toOriginal, model: 'local-ocr:test' });

describe('planReadingFromOcr', () => {
  it('ids σταθερά με τη σειρά, κενά κείμενα έξω, raw αυτούσιο, βεβαιότητα = recScore ως παράγοντας reading', () => {
    const r = read([ocr('3.50', quad(0, 0, 40, 10), 0.97), ocr('  ', quad(0, 0, 5, 5)), ocr('ΣΑΛΟΝΙ', quad(50, 50, 60, 12), 0.7)]);
    expect(r.texts.map((t) => [t.id, t.raw, t.kind])).toEqual([['t1', '3.50', 'dimension'], ['t2', 'ΣΑΛΟΝΙ', 'other']]);
    expect(r.texts[0].confidence).toEqual({ score: 0.97, factors: { reading: 0.97 } });
    expect(r.model).toBe('local-ocr:test');
    expect(r.schemaVersion).toBe(OCR_READING_SCHEMA_VERSION);
    expect(r.rooms).toEqual([]);
    expect(r.openings).toEqual([]);
  });

  it('το πλαίσιο περνά από την ομογραφία κορυφή-κορυφή και μένει σφιχτό (κατακόρυφο κείμενο = ψηλό και στενό)', () => {
    const shift: Homography = { ...IDENTITY_HOMOGRAPHY, c: 100, f: 200 };
    const r = read([ocr('2.85', quad(10, 20, 8, 40), 0.9, 90)], shift);
    expect(r.texts[0].rect).toEqual({ minX: 110, minY: 220, maxX: 118, maxY: 260 });
  });

  it('μέτρα στο σχέδιο ⇒ οι ακέραιοι γίνονται εκατοστά· segmentIds κενά', () => {
    const r = read([ocr('3.50', quad(0, 0, 40, 10)), ocr('20', quad(0, 20, 20, 10))]);
    expect(r.dimensions.map((d) => [d.textId, d.valueMm, d.segmentIds])).toEqual([['t1', 3500, []], ['t2', 200, []]]);
  });

  it('μόνο ακέραιοι ⇒ κανένας περιορισμός του λύτη, τα κείμενα μένουν ορατά', () => {
    const r = read([ocr('350', quad(0, 0, 40, 10)), ocr('415', quad(0, 20, 40, 10))]);
    expect(r.dimensions).toEqual([]);
    expect(r.texts.map((t) => t.kind)).toEqual(['dimension', 'dimension']);
  });

  it('γραμμένη κλίμακα: η πιο βέβαιη ανάγνωση', () => {
    const r = read([ocr('1:100', quad(0, 0, 40, 10), 0.6), ocr('Κλ. 1:50', quad(0, 20, 60, 10), 0.95)]);
    expect(r.writtenScale).toEqual({ textId: 't2', denominator: 50, confidence: { score: 0.95, factors: { reading: 0.95 } } });
    expect(read([ocr('ΣΑΛΟΝΙ', quad(0, 0, 10, 10))]).writtenScale).toBeNull();
  });
});

describe('localOcrModelId — από το μητρώο, με τα revisions', () => {
  it('ανιχνευτής + αναγνώστες', () => {
    const m = (dir: string) => ({
      onnx: { path: `/models/ocr/${dir}/inference.onnx`, sha256: 'x', bytes: 1 },
      yml: { path: `/models/ocr/${dir}/inference.yml`, sha256: 'x', bytes: 1 },
    });
    const assets: OcrAssetSet = {
      runtime: { path: '/ort/1.30.0/ort-wasm-simd-threaded.wasm', sha256: 'x', bytes: 1 },
      detector: m('det@1'), primary: m('rec@2'), secondary: m('el@3'),
    };
    expect(localOcrModelId(assets)).toBe('local-ocr:det@1+rec@2+el@3');
  });
});

describe('ocrTextsInView — Φ0.6: ο ΙΔΙΟΣ κανόνας όψης με τα τμήματα (κέντρο κειμένου)', () => {
  const left = ocr('3.50', quad(100, 100, 40, 10)); // κέντρο (120, 105)
  const right = ocr('2.85', quad(800, 100, 40, 10)); // κέντρο (820, 105)
  const straddling = ocr('4.15', quad(480, 300, 60, 10)); // κέντρο (510, 305): εκτείνεται μέσα, το κέντρο έξω
  const texts = [left, right, straddling];
  const crop = { minX: 0, minY: 0, maxX: 500, maxY: 1000 };

  it('χωρίς όψη ⇒ όλα, όπως τα τμήματα της αρχικής εξαγωγής', () => {
    expect(ocrTextsInView(texts, undefined, IDENTITY_HOMOGRAPHY)).toBe(texts);
  });
  it('crop ⇒ μόνο όσα έχουν το κέντρο μέσα (όχι όσα απλώς ακουμπούν)', () => {
    expect(ocrTextsInView(texts, { crop, redacted: [] }, IDENTITY_HOMOGRAPHY)).toEqual([left]);
  });
  it('απόκρυψη μέσα στο crop ⇒ το κείμενο κάτω της δεν μετρά', () => {
    const view: PlanReadingView = { crop: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }, redacted: [{ minX: 700, minY: 0, maxX: 1000, maxY: 200 }] };
    expect(ocrTextsInView(texts, view, IDENTITY_HOMOGRAPHY)).toEqual([left, straddling]);
  });
  it('το κέντρο περνά από αρχικά px σε ευθυγραμμισμένα (originalToAligned)', () => {
    const shiftLeft: Homography = { ...IDENTITY_HOMOGRAPHY, c: -400 }; // 820 → 420 μέσα · 120 → -280 έξω
    expect(ocrTextsInView([left, right], { crop, redacted: [] }, shiftLeft)).toEqual([right]);
  });
});

describe('isLocalOcrOutcome — η προέλευση από το `model` (Δ9)', () => {
  const outcome = (model: string) => ({ status: 'read', reading: { ...read([]), model } }) as PlanReadingOutcome;
  it('τοπική ⇒ true· VLM ⇒ false· καμία ή όχι-read ⇒ false', () => {
    expect(isLocalOcrOutcome(outcome('local-ocr:det@1+rec@2+el@3'))).toBe(true);
    expect(isLocalOcrOutcome(outcome('gpt-x'))).toBe(false);
    expect(isLocalOcrOutcome(null)).toBe(false);
    expect(isLocalOcrOutcome({ status: 'unavailable', reason: 'no-key' } as unknown as PlanReadingOutcome)).toBe(false);
  });
});
